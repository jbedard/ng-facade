import { InjectableFacade } from "./facade";

declare module "angular" {
    interface IInjectStatic {
        // tslint:disable-next-line:callable-types
        (...fns: Array<InjectableFacade<(...args: any[]) => void>>): any; // void | (() => void);
    }
}