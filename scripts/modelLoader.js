import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
  constructor(modelsToLoad, onLoad) {
    this.loader = new GLTFLoader();
    this.models = {};
    this.modelsToLoad = modelsToLoad;
    this.onLoad = onLoad;

    this._loadModels();
  }

  _loadModels() {
    let remaining = Object.keys(this.modelsToLoad).length;

    Object.entries(this.modelsToLoad).forEach(([modelName, path]) => {
      this.loader.load(
        path,
        (gltf) => {
          this.models[modelName] = gltf.scene;
          remaining--;

          if (remaining === 0 && typeof this.onLoad === 'function') {
            this.onLoad(this.models);
          }
        },
        undefined,
        (err) => {
          console.error(`Error loading ${modelName}:`, err);
          remaining--;

          if (remaining === 0 && typeof this.onLoad === 'function') {
            this.onLoad(this.models);
          }
        }
      );
    });
  }
}