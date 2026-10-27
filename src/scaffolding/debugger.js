import styles from './style.css';

class PackagedDebugger {
  constructor (scaffolding) {
    this.scaffolding = scaffolding;
    this.logs = [];
    this.timers = {};

    this.root = document.createElement('section');
    this.root.className = styles.debuggerRoot;
    this.root.hidden = true;

    const header = document.createElement('div');
    header.className = styles.debuggerHeader;
    this.title = document.createElement('strong');
    this.title.textContent = 'Debugger';
    header.appendChild(this.title);

    this.resumeButton = document.createElement('button');
    this.resumeButton.textContent = 'Resume';
    this.resumeButton.hidden = true;
    this.resumeButton.addEventListener('click', () => scaffolding.vm.setPaused(false));
    header.appendChild(this.resumeButton);

    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => this.clear());
    header.appendChild(clearButton);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      this.root.hidden = true;
    });
    header.appendChild(closeButton);

    this.output = document.createElement('div');
    this.output.className = styles.debuggerOutput;
    this.timerOutput = document.createElement('div');
    this.timerOutput.className = styles.debuggerTimers;

    this.root.appendChild(header);
    this.root.appendChild(this.output);
    this.root.appendChild(this.timerOutput);
    scaffolding._layers.appendChild(this.root);

    const runtime = scaffolding.vm.runtime;
    runtime.on('DEBUGGER_BREAKPOINT', () => this.breakpoint());
    runtime.on('DEBUGGER_LOG', (type, message, target, color) => this.log(type, message, target, color));
    runtime.on('DEBUGGER_CLEAR', () => this.clear());
    runtime.on('DEBUGGER_TIMER_UPDATE', timers => this.updateTimers(timers));
    runtime.on('RUNTIME_UNPAUSED', () => {
      this.resumeButton.hidden = true;
      this.title.textContent = 'Debugger';
    });
  }

  show () {
    this.root.hidden = false;
  }

  breakpoint () {
    this.title.textContent = 'Paused at breakpoint';
    this.resumeButton.hidden = false;
    this.show();
  }

  log (type, message, target, color) {
    const row = document.createElement('div');
    row.className = styles.debuggerLog;
    row.dataset.type = type || 'log';
    if (color) {
      row.style.borderLeftColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    }
    const prefix = target && target.getName ? `${target.getName()}: ` : '';
    row.textContent = prefix + message;
    this.logs.push(row);
    this.output.appendChild(row);
    this.output.scrollTop = this.output.scrollHeight;
    this.show();
  }

  clear () {
    this.logs.length = 0;
    this.output.textContent = '';
  }

  updateTimers (timers) {
    this.timers = timers || {};
    this.timerOutput.textContent = '';
    for (const name of Object.keys(this.timers)) {
      const timer = this.timers[name];
      const row = document.createElement('div');
      const average = timer.average === null ? '-' : `${timer.average.toFixed(2)} ms`;
      row.textContent = `${name}: ${timer.count} runs, ${average} average`;
      this.timerOutput.appendChild(row);
    }
    if (Object.keys(this.timers).length) this.show();
  }
}

export default PackagedDebugger;
