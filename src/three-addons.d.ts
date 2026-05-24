// three ships the examples/jsm modules without bundled type declarations under
// "Bundler" module resolution. Declare the one addon we use here.
declare module "three/examples/jsm/environments/RoomEnvironment.js" {
  import type { Scene } from "three";
  export class RoomEnvironment extends Scene {
    constructor();
  }
}
