import { FacadeInjectable } from "./facade";

declare module "angular" {
    interface IInjectStatic {
        // tslint:disable-next-line:callable-types
        (...fns: Array<FacadeInjectable<(...args: any[]) => void>>): any; // void | (() => void);
    }
}