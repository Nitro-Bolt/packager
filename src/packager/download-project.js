import optimizeSb3Json from './minify/sb3';
import {downloadProjectFromBuffer} from '@turbowarp/sbdl';

const unknownAnalysis = () => ({
  stageVariables: [],
  hasStoredSettings: false,
  usesMusic: true,
  usesSteamworks: false,
  usesRichPresence: false,
  extensions: []
});

const hasStoredProjectOptions = (projectData) => {
  if (!Object.prototype.hasOwnProperty.call(projectData, 'projectOptions')) {
    return false;
  }
  const options = projectData.projectOptions;
  if (options === null || options === undefined) {
    return false;
  }
  if (typeof options === 'string') {
    const trimmed = options.trim();
    return trimmed !== '' && trimmed !== '{}';
  }
  if (typeof options === 'object') {
    return Object.keys(options).length > 0;
  }
  return true;
};

const analyzeScratch2 = (projectData) => {
  const stageVariables = (projectData.variables || [])
    .map(({name, isPersistent}) => ({
      name,
      isCloud: isPersistent
    }));
  // This may have some false positives, but that's okay.
  const stringified = JSON.stringify(projectData);
  const usesMusic = stringified.includes('drum:duration:elapsed:from:') ||
    stringified.includes('playDrum') ||
    stringified.includes('noteOn:duration:elapsed:from:');
  return {
    ...unknownAnalysis(),
    stageVariables,
    usesMusic
  };
};

const analyzeScratch3 = (projectData) => {
  const stage = projectData.targets[0];
  if (!stage || !stage.isStage) {
    throw new Error('Project does not have stage');
  }
  const stageVariables = Object.values(stage.variables)
    .map(([name, _value, cloud]) => ({
      name,
      isCloud: !!cloud
    }));
  // TODO: usesMusic has possible false negatives
  const usesMusic = projectData.extensions.includes('music');
  const usesSteamworks = projectData.extensions.includes('steamworks');
  const usesRichPresence = projectData.extensions.includes('cubesterRichPresence');
  const extensions = projectData.extensionURLs ? Object.values(projectData.extensionURLs) : [];
  return {
    ...unknownAnalysis(),
    stageVariables,
    hasStoredSettings: hasStoredProjectOptions(projectData),
    usesMusic,
    usesSteamworks,
    usesRichPresence,
    extensions
  };
};

const mutateScratch3InPlace = (projectData) => {
  const makeImpliedCloudVariables = (projectData) => {
    const stage = projectData.targets.find((i) => i.isStage);
    if (stage) {
      for (const variable of Object.values(stage.variables)) {
        const name = variable[0];
        if (typeof name === 'string' && name.startsWith('☁')) {
          variable[2] = true;
        }
      }
    }
  };

  const disableNonsenseCloudVariables = (projectData) => {
    const DISABLE_CLOUD_VARIABLES = [
      // The "original" Sprunki project includes a cloud variable presumably used to detect who
      // clicked on the report button. That seems like a Scratch community guidelines violation but
      // that's not our job to enforce. This affects us because these games are very popular and
      // create thousands of unnecessary concurrent cloud variable connections for a feature that
      // can't work because there is no report button to click on.
      '☁ potential reporters'
    ];

    // I want a more general solution here that automatically disables all unused cloud variables,
    // but making that work in the presence of various unknown extensions seems non-trivial.

    const stage = projectData.targets.find((i) => i.isStage);
    if (stage) {
      for (const variable of Object.values(stage.variables)) {
        // variable is [name, value, isCloud]
        if (variable[2] && DISABLE_CLOUD_VARIABLES.includes(variable[0])) {
          variable[2] = false;
        }
      }
    }
  };

  // Order matters -- check for implied cloud variables before disabling some of them.
  makeImpliedCloudVariables(projectData);
  disableNonsenseCloudVariables(projectData);
  optimizeSb3Json(projectData);
};

export const downloadProject = async (projectData, progressCallback = () => {}, signal) => {
  let analysis = unknownAnalysis();

  const options = {
    signal,

    onProgress(type, loaded, total) {
      progressCallback(type, loaded, total);
    },

    processJSON(type, projectData) {
      if (type === 'sb3') {
        mutateScratch3InPlace(projectData);
        analysis = analyzeScratch3(projectData);
        return projectData;
      }
      if (type === 'sb2') {
        analysis = analyzeScratch2(projectData);
      }
    }
  };

  const project = await downloadProjectFromBuffer(projectData, options);
  if (project.type !== 'sb3') {
    project.type = 'blob';
  }
  project.analysis = analysis;
  return project;
};
