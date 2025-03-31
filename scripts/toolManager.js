export class ToolManager {
    constructor() {
      this.toolModel = null;
      this.subscribers = [];
    }
  
    // Called when the tool model has loaded
    setToolModel(model) {
      this.toolModel = model;
      this.notifySubscribers();
    }
  
    // Register a callback to be notified when the tool becomes available.
    subscribe(callback) {
      if (this.toolModel) {
        callback(this.toolModel);
      } else {
        this.subscribers.push(callback);
      }
    }
  
    notifySubscribers() {
      this.subscribers.forEach((callback) => callback(this.toolModel));
      this.subscribers = []; // Clear after notifying
    }
  }