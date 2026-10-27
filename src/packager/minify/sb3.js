// Keep this lossless and synchronized with scratch-vm's tw-compress-sb3 implementation.
// Comments and cross-object IDs are project data, not disposable editor metadata.
const SOUP = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#%()*+,-./:;=?@[]^_`{|}~';

const generateId = index => {
  let result = '';
  while (index >= 0) {
    result = SOUP[index % SOUP.length] + result;
    index = Math.floor(index / SOUP.length) - 1;
  }
  return result;
};

class Pool {
  constructor () {
    this.generatedIds = new Map();
    this.references = new Map();
    this.skippedIds = new Set(['of']);
  }

  skip (id) {
    this.skippedIds.add(id);
  }

  addReference (id) {
    this.references.set(id, (this.references.get(id) || 0) + 1);
  }

  generateNewIds () {
    const entries = Array.from(this.references.entries());
    entries.sort((a, b) => b[1] - a[1]);
    let index = 0;
    for (const [oldId] of entries) {
      let newId = generateId(index);
      while (this.skippedIds.has(newId)) {
        index++;
        newId = generateId(index);
      }
      this.generatedIds.set(oldId, newId);
      index++;
    }
  }

  getNewId (originalId) {
    return this.generatedIds.get(originalId) || originalId;
  }
}

const optimizeSb3Json = projectData => {
  const pool = new Pool();

  for (const target of projectData.targets) {
    for (const collection of ['variables', 'lists', 'tables', 'broadcasts']) {
      for (const id of Object.keys(target[collection] || {})) pool.skip(id);
    }
    for (const [blockId, block] of Object.entries(target.blocks || {})) {
      pool.addReference(blockId);
      if (Array.isArray(block)) continue;
      if (block.parent) pool.addReference(block.parent);
      if (block.next) pool.addReference(block.next);
      if (block.comment) pool.addReference(block.comment);
      for (const input of Object.values(block.inputs || {})) {
        for (let index = 1; index < input.length; index++) {
          if (typeof input[index] === 'string') pool.addReference(input[index]);
        }
      }
    }
    for (const [commentId, comment] of Object.entries(target.comments || {})) {
      pool.addReference(commentId);
      if (comment.blockId) pool.addReference(comment.blockId);
    }
  }

  pool.generateNewIds();
  for (const target of projectData.targets) {
    const newBlocks = {};
    const newComments = {};
    for (const [blockId, block] of Object.entries(target.blocks || {})) {
      newBlocks[pool.getNewId(blockId)] = block;
      if (Array.isArray(block)) continue;
      if (block.parent) block.parent = pool.getNewId(block.parent);
      if (block.next) block.next = pool.getNewId(block.next);
      if (block.comment) block.comment = pool.getNewId(block.comment);
      for (const input of Object.values(block.inputs || {})) {
        for (let index = 1; index < input.length; index++) {
          if (typeof input[index] === 'string') input[index] = pool.getNewId(input[index]);
        }
      }
    }
    for (const [commentId, comment] of Object.entries(target.comments || {})) {
      newComments[pool.getNewId(commentId)] = comment;
      if (comment.blockId) comment.blockId = pool.getNewId(comment.blockId);
    }
    target.blocks = newBlocks;
    target.comments = newComments;
  }
  return projectData;
};

export default optimizeSb3Json;
