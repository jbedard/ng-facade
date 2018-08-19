/**
 * @license ng-facade
 * (c) 2018 Jason Bedard
 * License: MIT
 */

import { identity, module, noop } from "angular";

/* TODO...
    - component lifecycle interfaces: https://angular.io/docs/ts/latest/guide/lifecycle-hooks.html ?
    - @Optional, @Self, @SkipSelf, @Host
    - @ViewChild ?
    - ElementRef ? (https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/linker/element_ref.ts#L24)
*/


function valueFn<T>(v: T): () => T { return () => v; }

//https://github.com/angular/angular/blob/2.4.8/modules/%40angular/core/src/type.ts
const TypeFacade = Function;
export interface TypeFacade<T> extends Function { new (...args: any[]): T; }


export type InjectableFacade<T extends Function> = T | Array<string | TypeFacade<any> | any | T>;


//Augment some AngularJS interfaces to allow passing types.
//Basically copy and pasted, but use the local `InjectableFacade` which allows injecting by type.
//https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
declare module "angular" {
    interface IModule {
        controller(name: string | TypeFacade<any>, controllerConstructor: InjectableFacade<angular.IControllerConstructor>): angular.IModule;
        controller(object: {[name: string]: InjectableFacade<angular.IControllerConstructor>}): angular.IModule;

        directive(name: string | TypeFacade<any>, directiveFactory: InjectableFacade<angular.IDirectiveFactory>): angular.IModule;
        directive(object: {[directiveName: string]: InjectableFacade<angular.IDirectiveFactory>}): angular.IModule;

        factory(name: string | TypeFacade<any>, $getFn: InjectableFacade<Function>): angular.IModule;
        factory(object: {[name: string]: InjectableFacade<Function>}): angular.IModule;

        filter(name: string, filterFactoryFunction: InjectableFacade<Function>): angular.IModule;
        filter(object: {[name: string]: InjectableFacade<Function>}): angular.IModule;

        run(initializationFunction: InjectableFacade<Function>): angular.IModule;

        service(name: string | TypeFacade<any>, serviceConstructor: InjectableFacade<Function>): angular.IModule;
        service(object: {[name: string]: InjectableFacade<Function>}): angular.IModule;

        decorator(name: string | TypeFacade<any>, decorator: InjectableFacade<Function>): angular.IModule;
    }

    namespace auto {
        interface IInjectorService {
            get<T>(type: TypeFacade<T>, caller?: string): T;
            get(type: any, caller?: string): any;
            has(type: any): boolean;
        }

        interface IProvideService {
            constant(type: TypeFacade<any>, value: any): void;
            decorator(type: TypeFacade<any>, decorator: Function | any[]): void;
            factory(type: TypeFacade<any>, serviceFactoryFunction: Function | any[]): angular.IServiceProvider;
            provider(type: TypeFacade<any>, provider: Function | angular.IServiceProvider): angular.IServiceProvider;
            service(type: TypeFacade<any>, constructor: Function | any[]): angular.IServiceProvider;
            value(type: TypeFacade<any>, value: any): angular.IServiceProvider;
        }
    }
}


//For internal data, could be swapped for map-like structures
function hasMeta(k: string, o: any): boolean {
    return Reflect.hasOwnMetadata(k, o);
}
function setMeta(k: string, v: any, o: any): void {
    Reflect.defineMetadata(k, v, o);
}
function getMeta(k: string, o: any): any {
    return Reflect.getOwnMetadata(k, o);
}

function getOrSetMeta<T>(metadataKey: string, metadataValue: T, target: Object): T {
    let v: T = getMeta(metadataKey, target);
    if (undefined === v) {
        setMeta(metadataKey, v = metadataValue, target);
    }
    return v;
}

//Internal data keys
const META_COMPONENT  = "@ComponentFacade";
const META_DIRECTIVE  = "@DirectiveFacade";
const META_InjectableFacade = "@InjectableFacade";
const META_INPUTS     = "@InputFacade";
const META_MODULE     = "@NgModuleFacade";
const META_PIPE       = "@PipeFacade";
const META_PRE_LINK   = "preLink";
const META_REQUIRE    = "@RequireFacade";

function getTypeName(type: string | Function): string {
    if (typeof type === "string") {
        return type;
    }
    return <string>getMeta(META_InjectableFacade, type);
}

//A counter/uid for Object => string identifiers
let tid = 0;

function toTypeName(type: string | Function): string {
    let typeName = getTypeName(type);
    if (!typeName) {
        typeName = (<any>type).name + (window["angular"].mock ? "" : `_${tid++}`);
        setMeta(META_InjectableFacade, typeName, type);
    }
    return typeName;
}

function getModuleName(mod: string | angular.IModule | TypeFacade<any>): string {
    if (typeof mod === "string") {
        return mod;
    }
    else if (hasMeta(META_MODULE, mod)) {
        return (<NgModuleFacade>getMeta(META_MODULE, mod)).id;
    }
    else {
        return (<angular.IModule>mod).name;
    }
}

function getInjectArray(target: InjectableFacade<any>): Array<InjectableFacade<any>> {
    return target.$inject || (target.$inject = <string[]>(target.$inject || []));
}

function dashToCamel(s: string): string {
    return s.replace(/-([a-z])/g, (a, letter) => letter.toUpperCase());
}


const COMPONENT_SELF_BINDING = "$$self";


/**
 * Build the AngularJS style `$inject` array for the passed object, converting Angular style to AngularJS.
 *
 * Supports:
 *    - AngularJS style `['InjectedName', InjectedClass, methodFoo]` or `methodFoo.$inject = ['InjectedName', InjectedClass]`
 *    - Angular style `@InjectableFacade() class Foo { constructor(@InjectFacade("InjectedName") localName){} }`
 *    - Angular style `@InjectableFacade() class Foo { constructor(private localName: InjectedClass){} }`
 *    - any mix of the above
 */
function injectMethod(method: InjectableFacade<any>) {
    //Array<string | TypeFacade> => Array<string>
    if (Array.isArray(method)) {
        for (let i = 0; i < method.length - 1; i++) {
            if (typeof method[i] !== "string") {
                method[i] = getTypeName(method[i]);
            }
        }
        return method;
    }

    //@InjectableFacade() (or any annotation?)
    //Extract the object types via TypeScript metadata
    const paramTypes: Array<TypeFacade<any>> = Reflect.getMetadata("design:paramtypes", method);
    if (paramTypes) {
        const $paramsInject = getInjectArray(method);

        for (let i = 0; i < paramTypes.length; i++) {
            //Try to extract types via TypeScript if currently unknown
            if (undefined === $paramsInject[i]) {
                $paramsInject[i] = paramTypes[i];
            }
        }
    }

    //Types extracted from TypeScript or specificed manually in $inject
    const $inject = method.$inject;
    if ($inject) {
        for (let i = 0; i < $inject.length; i++) {
            //Convert type => string for injection via types
            if (typeof $inject[i] !== "string") {
                $inject[i] = getTypeName($inject[i]);
            }
        }
    }

    return method;
}


function isPipeTransform(o: ProviderFacade): o is PipeTransformFacade & TypeProviderFacade {
    return hasMeta(META_PIPE, o);
}
function isExistingProvider(o: ProviderFacade): o is ExistingProviderFacade {
    return "useExisting" in o;
}
function isFactoryProvider(o: ProviderFacade): o is FactoryProviderFacade  {
    return "useFactory" in o;
}
function isClassProvider(o: ProviderFacade): o is ClassProviderFacade {
    return "useClass" in o;
}
function isValueProvider(o: ProviderFacade): o is ValueProviderFacade {
    return "useValue" in o;
}

function setupProvider(mod: angular.IModule, provider: ProviderFacade): void {
    //ProviderFacade type detection similar to:
    // https://github.com/angular/angular/blob/2.4.4/modules/%40angular/core/src/di/reflective_provider.ts#L103
    // +
    // https://github.com/angular/angular/blob/2.4.4/modules/%40angular/core/src/di/reflective_provider.ts#L181

    //PipeTransformFacade
    if (isPipeTransform(provider)) {
        const pipeInfo: PipeFacade = getMeta(META_PIPE, provider);
        mod.service(provider, provider);
        mod.filter(pipeInfo.name, [provider, function(pipe: PipeTransformFacade) {
            const transform = pipe.transform.bind(pipe);
            transform.$stateful = (false === pipeInfo.pure);
            return transform;
        }]);
    }
    //ExistingProviderFacade
    else if (isExistingProvider(provider)) {
        mod.factory(provider.provide, [provider.useExisting, identity]);
    }
    //FactoryProviderFacade
    else if (isFactoryProvider(provider)) {
        const factory = provider.useFactory;
        if (provider.deps) {
            if (factory.$inject) {
                throw new Error("Can not declare both $inject and deps for a factory");
            }
            factory.$inject = provider.deps;
        }
        mod.factory(provider.provide, factory);
    }
    //ClassProviderFacade
    else if (isClassProvider(provider)) {
        mod.service(provider.provide, provider.useClass);
    }
    //ValueProviderFacade
    else if (isValueProvider(provider)) {
        mod.factory(provider.provide, valueFn(provider.useValue));
    }
    //TypeProviderFacade
    else /*if (provider instanceof TypeFacade)*/ {
        mod.service(getTypeName(<TypeFacade<any>>provider), <TypeProviderFacade>provider);
    }
}

function createCompileFunction(ctrl: TypeFacade<any>, $injector: angular.auto.IInjectorService): angular.IDirectiveCompileFn | undefined {
    const pre: Array<InjectableFacade<any>> = getMeta(META_PRE_LINK, ctrl.prototype);

    if (pre) {
        return valueFn({
            pre($scope: angular.IScope, $element: JQuery, $attrs: angular.IAttributes, ctrls: {[key: string]: angular.IController}) {
                const locals = {$scope, $element, $attrs};
                for (const f of pre) {
                    $injector.invoke(f, ctrls[COMPONENT_SELF_BINDING], locals);
                }
            }
        });
    }
    return undefined;
}

function addPreLink(targetPrototype: Object, fn: InjectableFacade<any>): void {
    getOrSetMeta(META_PRE_LINK, <Array<InjectableFacade<any>>>[], targetPrototype).push(fn);
}

function setupComponent(mod: angular.IModule, ctrl: TypeFacade<any>, decl: ComponentFacade): void {
    const bindings: {[name: string]: string} = {};

    //@InputFacade(TypeFacade)s
    (getMeta(META_INPUTS, ctrl) || []).forEach(function(input: InternalBindingMetadata) {
        bindings[input.name] = input.type + "?" + (input.publicName || "");
    });

    //Reference to self
    const require = {[COMPONENT_SELF_BINDING]: dashToCamel(decl.selector)};

    //@RequireFacade()s
    const required = getMeta(META_REQUIRE, ctrl);
    for (const key in required) {
        require[key] = dashToCamel(required[key]);
    }

    //Simplified component -> directive mapping similar to
    // https://github.com/angular/angular.js/blob/v1.6.2/src/ng/compile.js#L1227

    mod.directive(dashToCamel(decl.selector), ["$injector", function($injector: angular.auto.IInjectorService): angular.IDirective {
        return {
            //https://github.com/angular/angular.js/blob/v1.6.2/src/ng/compile.js#L1242-L1252
            controller: ctrl,
            controllerAs: decl.controllerAs || "$ctrl",
            template: decl.template,
            transclude: decl.transclude,
            scope: {},
            bindToController: bindings,
            restrict: "E",
            require,

            //Create a compile function to do setup
            compile: createCompileFunction(ctrl, $injector)
        };
    }]);
}

function setupDirective(mod: angular.IModule, ctrl: TypeFacade<any>, decl: DirectiveFacade): void {
    //Element vs attribute
    //AngularJS does not support complex selectors
    //Angular does not support comments
    let name = decl.selector;
    let restrict = "E";
    if (name[0] === "[" && name[name.length - 1] === "]") {
        name = name.slice(1, name.length - 1);
        restrict = "A";
    }
    else if (name[0] === ".") {
        name = name.slice(1);
        restrict = "C";
    }

    //TODO: inputs on DirectiveFacade which has no isolated scope?
    if (hasMeta(META_INPUTS, ctrl)) {
        throw new Error("DirectiveFacade input unsupported");
    }

    //TODO: require on DirectiveFacade which has no isolated scope?
    if (hasMeta(META_REQUIRE, ctrl)) {
        throw new Error("DirectiveFacade require unsupported");
    }

    //reference to self
    const require = {[COMPONENT_SELF_BINDING]: dashToCamel(name)};

    mod.directive(dashToCamel(name), ["$injector", function($injector: angular.auto.IInjectorService): angular.IDirective {
        return {
            restrict,
            controller: ctrl,
            require,

            //Create a compile function to do setup
            compile: createCompileFunction(ctrl, $injector)
        };
    }]);
}

function setupDeclaration(mod: angular.IModule, decl: TypeFacade<any>): void {
    if (hasMeta(META_COMPONENT, decl)) {
        setupComponent(mod, decl, getMeta(META_COMPONENT, decl));
    }
    else if (hasMeta(META_DIRECTIVE, decl)) {
        setupDirective(mod, decl, getMeta(META_DIRECTIVE, decl));
    }
    else {
        throw new Error(`Unknown declaration: ${decl}`);
    }
}


/**
 * @InjectableFacade()
 *
 * Marks a class as InjectableFacade. Required in this library, optional in Angular.
 *
 * https://angular.io/docs/ts/latest/api/core/index/InjectableFacade-decorator.html
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/di/metadata.ts#L146
export function InjectableFacade(): ClassDecorator {
    return function(constructor: Function): void {
        toTypeName(constructor);
    };
}


/**
 * @InjectFacade
 *
 * Manually inject by name.
 *
 * https://angular.io/docs/ts/latest/api/core/index/InjectFacade-decorator.html
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/di/metadata.ts#L53
export function InjectFacade(thing: string): ParameterDecorator {
    return function(target: Object, propertyKey: string, propertyIndex: number): void {
        getInjectArray(target)[propertyIndex] = thing;
    };
}


/**
 * Paramaters for @PipeFacade
 *
 * https://angular.io/docs/ts/latest/api/core/index/PipeFacade-interface.html
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/metadata/directives.ts#L743
export interface PipeFacade {
    name: string;
    pure?: boolean;
}

/**
 * PipeTransformFacade interface for @PipeFacade classes.
 *
 * https://angular.io/docs/ts/latest/api/core/index/PipeTransform-interface.html
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/change_detection/pipe_transform.ts#L38
export interface PipeTransformFacade {
    transform: (value: any, ...args: any[]) => any;
}

/**
 * @PipeFacade
 *
 * Marks a class as a PipeFacade.
 *
 * Works as a filter in AngularJS.
 */
export function PipeFacade(info: PipeFacade): ClassDecorator {
    return function(constructor: Function): void {
        toTypeName(constructor);
        setMeta(META_PIPE, info, constructor);
    };
}


interface InternalBindingMetadata {
    name: string;
    publicName: string | undefined;
    type: string;
}

function addBinding(targetPrototype: Object, data: InternalBindingMetadata): void {
    getOrSetMeta(META_INPUTS, <InternalBindingMetadata[]>[], targetPrototype.constructor).push(data);
}

function createInputDecorator(type: string) {
    return function InputDecorator(publicName?: string): PropertyDecorator {
        return function(targetPrototype: Object, propertyKey: string): void {
            addBinding(targetPrototype, {
                name: propertyKey,
                publicName: publicName && dashToCamel(publicName),
                type
            });
        };
    };
}

/**
 * @InputFacade
 *
 * Marks a field as a ComponentFacade/DirectiveFacade input.
 *
 * https://angular.io/docs/ts/latest/api/core/index/Input-interface.html
 */
export const InputFacade = createInputDecorator("<");

/**
 * @InputStringFacade
 *
 * Non-standard helper for declaring input strings. Could be converted to plain @Input in Angular.
 *
 * Works as a @-binding in AngularJS.
 */
export const InputStringFacade = createInputDecorator("@");

/**
 * @InputCallbackFacade
 *
 * Non-standard helper for declaring callback style bindings.
 * **WARNING** Has no direct Angular replacement. Try to use @OutputFacade EventEmmitter instead.
 *
 * Works as a &-binding in AngularJS.
 */
export const InputCallbackFacade = createInputDecorator("&");


/**
 * EventEmitterFacade
 *
 * A subset of the Angular interface.
 *
 * https://angular.io/docs/ts/latest/api/core/index/EventEmitter-class.html
 */
//https://github.com/angular/angular/blob/2.4.7/modules/%40angular/facade/src/async.ts
export class EventEmitterFacade<T> {
    public emit(value?: T): void {
        throw new Error("Uninitialized EventEmitterFacade");
    }
}

const OUTPUT_BOUND_CALLBACK_PREFIX = "__event_";

/**
 * @OutputFacade
 *
 * https://angular.io/docs/ts/latest/api/core/index/Output-interface.html
 */
export function OutputFacade(publicName?: string): PropertyDecorator {
    return function(targetPrototype: Object, propertyKey: string): void {
        const propertyType: TypeFacade<any> = Reflect.getMetadata("design:type", targetPrototype, propertyKey);
        if (!(propertyType === EventEmitterFacade || propertyType.prototype instanceof EventEmitterFacade)) {
            throw new Error(`${(<any>targetPrototype.constructor).name}.${propertyKey} type must be EventEmitterFacade`);
        }

        const internalCallback = OUTPUT_BOUND_CALLBACK_PREFIX + propertyKey;

        addBinding(targetPrototype, {
            name: internalCallback,
            publicName: publicName && dashToCamel(publicName) || propertyKey,
            type: "&"
        });

        addPreLink(targetPrototype, function(this: TypeFacade<any>) {
            (<EventEmitterFacade<any>>this[propertyKey]).emit = (value) => {
                (this[internalCallback] || noop)({$event: value});
            };
        });
    };
}


/**
 * @HostListenerFacade
 *
 * Bind a DOM event to the host element.
 *
 * https://angular.io/docs/ts/latest/api/core/index/HostListener-interface.html
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/metadata/directives.ts#L1005-L1017
export function HostListenerFacade(eventType: string, args: string[] = []): MethodDecorator {
    return function(targetPrototype: Object, propertyKey: string): void {
        function HostListenerFacadeSetup(this: TypeFacade<any>, $element: JQuery, $parse: angular.IParseService, $rootScope: angular.IScope): void {
            //Parse the listener arguments on component initialization
            const argExps = args.map((s) => $parse(s));

            $element.on(eventType, ($event: BaseJQueryEventObject) => {
                //Invoke each argument expression specifying the $event local
                const argValues = argExps.map((argExp) => argExp({$event}));
                const invokeListener = () => this[propertyKey](...argValues);

                if (!$rootScope.$$phase) {
                    $rootScope.$apply(invokeListener);
                }
                else {
                    invokeListener();
                }
            });
        }
        HostListenerFacadeSetup.$inject = ["$element", "$parse", "$rootScope"];

        addPreLink(targetPrototype, HostListenerFacadeSetup);
    };
}


/**
 * @RequireFacade
 *
 * Non-standard helper for AngularJS `require`.
 */
export function RequireFacade(name?: string): PropertyDecorator {
    const needsName = !name || /^[\^\?]+$/.test(name);

    return function(targetPrototype: Object, propertyKey: string): void {
        getOrSetMeta(META_REQUIRE, {}, targetPrototype.constructor)[propertyKey] = (name || "") + (needsName ? propertyKey : "");
    };
}


/**
 * A subset of the @DirectiveFacade interface
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/metadata/directives.ts#L79
export interface DirectiveFacade {
    selector: string;

    //NOT SUPPORTED...
    // providers: ProviderFacade[];
    // exportAs: string;
    // queries: {[key: string]: any};
    // host: {[key: string]: string};

    //MAYBE LATER:
    // inputs?: string[];
    // outputs: string[];    requires EventEmitterFacade?
}

/**
 * @DirectiveFacade
 *
 * Marks a class as a directive. A subset of the standard Angular features.
 *
 * https://angular.io/docs/ts/latest/api/core/index/Directive-decorator.html
 */
export function DirectiveFacade(info: DirectiveFacade): ClassDecorator {
    return function(constructor: Function): void {
        setMeta(META_DIRECTIVE, info, constructor);
    };
}


/**
 * A subset of the @ComponentFacade interface
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/metadata/directives.ts#L487
export interface ComponentFacade extends DirectiveFacade {
    template?: string | any;    //NOTE: added "| any" to support CJS `require(...)`

    //AngularJS specific
    transclude?: boolean | {[slot: string]: string};
    controllerAs?: string;


    //NOT SUPPORTED...
    // animations: AnimationEntryMetadata[];
    // encapsulation: ViewEncapsulation;
    // interpolation: [string, string];
    // changeDetection: ChangeDetectionStrategy;

    //Loading of templates + stylesheets must be done elsewhere (ex: webpack)
    // moduleId: string;
    // templateUrl: string;
    // styleUrls: string[];
    // styles: string[];

    // Dependencies on other component/directives
    // viewProviders: ProviderFacade[];

    //ComponentFacade dependencies
    // entryComponents: Array<TypeFacade<any>|any[]>;
}

/**
 * @ComponentFacade
 *
 * Mark a class as a component. A subset of the standard Angular features.
 *
 * Additions:
 *     transclude: for AngularJS transclusion
 *     controllerAs: for AngularJS naming of controllers
 *
 * https://angular.io/docs/ts/latest/api/core/index/ComponentFacade-decorator.html
 */
export function ComponentFacade(info: ComponentFacade): ClassDecorator {
    return function(constructor: Function): void {
        setMeta(META_COMPONENT, info, constructor);
    };
}


//https://github.com/angular/angular/blob/2.4.8/modules/%40angular/core/src/di/provider.ts
export interface TypeProviderFacade extends TypeFacade<any> {}
export interface ValueProviderFacade {
  provide: any;
  useValue: any;
  // multi?: boolean;
}
export interface ClassProviderFacade {
  provide: any;
  useClass: TypeFacade<any>;
  // multi?: boolean;
}
export interface ExistingProviderFacade {
  provide: any;
  useExisting: any;
  // multi?: boolean;
}
export interface FactoryProviderFacade {
  provide: any;
  useFactory: Function;
  deps?: any[];
  // multi?: boolean;
}
export type ProviderFacade = TypeProviderFacade | ValueProviderFacade | ClassProviderFacade | ExistingProviderFacade | FactoryProviderFacade/* | any[]*/;


/**
 * A subset of the @NgModuleFacade interface
 */
//https://github.com/angular/angular/blob/2.4.5/modules/%40angular/core/src/metadata/ng_module.ts#L70
export interface NgModuleFacade {
    id: string;

    providers?: ProviderFacade[];
    declarations?: Array<TypeFacade<any>/*|any[]*/>;
    imports?: Array<angular.IModule|TypeFacade<any>|string>;

    //NOT SUPPORTED...
    // entryComponents: Array<TypeFacade<any>|any[]>;
    // bootstrap: Array<TypeFacade<any>|any[]>;
    // schemas: Array<SchemaMetadata|any[]>;

    //Everything is exported in AngularJS
    // exports: Array<TypeFacade<any>|any[]>;
}

/**
 * @NgModuleFacade
 *
 * Mark a class as a module. A subset of the standard Angular features.
 *
 * Additions:
 *      Allows AngularJS modules (or names) as imports
 *
 * https://angular.io/docs/ts/latest/api/core/index/NgModule-interface.html
 */
export function NgModuleFacade(info: NgModuleFacade): ClassDecorator {
    return function(constructor: Function): void {
        const mod = module(info.id, (info.imports || []).map(getModuleName));

        (info.providers || []).forEach(function(provider) {
            setupProvider(mod, provider);
        });

        (info.declarations || []).forEach(function(decl) {
            setupDeclaration(mod, decl);
        });

        //Invoke the constructor when the module is setup
        //TODO: create an instance?
        mod.run(constructor);

        setMeta(META_MODULE, info, constructor);
    };
}

/**
 * The `OnInit` interface, with the AngularJS method $onInit() method.
 *
 * https://angular.io/docs/ts/latest/api/core/index/OnInit-class.html
 */
export interface OnInitFacade {
    $onInit(): void;
}

/**
 * The `DoCheck` interface, with the AngularJS method $doCheck() method.
 *
 * https://angular.io/docs/ts/latest/api/core/index/DoCheckFacade-class.html
 */
export interface DoCheckFacade {
    $doCheck(): void;
}

/**
 * The `OnChanges` interface, with the AngularJS method $onChanges(IOnChangesObject) method.
 *
 * https://angular.io/docs/ts/latest/api/core/index/OnChanges-class.html
 */
export interface OnChangesFacade {
    $onChanges(onChangesObj: angular.IOnChangesObject): void;
}

/**
 * The `OnDestroy` interface, with the AngularJS method $onDestroy() method.
 *
 * https://angular.io/docs/ts/latest/api/core/index/OnDestroy-class.html
 */
export interface OnDestroyFacade {
    $onDestroy(): void;
}

//TODO?: $postLink(): void


// Decorate the AngularJS injector to support Types in addition to standard strings.
// Follow the Types + arguments declared in @types definition + the ng-facade overrides
module("ng").decorator("$injector", ["$delegate", function(injector: angular.auto.IInjectorService): angular.auto.IInjectorService {
    const {get, has, instantiate, invoke} = injector;

    // get<T>(name: string, caller?: string): T;
    // get<T>(type: TypeFacade<T>, caller?: string): T;
    // get(type: any, caller?: string): any;
    injector.get = function diGetWrapper(this: angular.auto.IInjectorService, what: any, caller?: string): any {
        return get.call(this, getTypeName(what), caller);
    };

    // has(name: string): boolean;
    // has(type: any): boolean;
    injector.has = function diHasWrapper(this: angular.auto.IInjectorService, what: string | TypeFacade<any>): boolean {
        return has.call(this, getTypeName(what));
    };

    // instantiate<T>(typeConstructor: Function, locals?: any): T;
    injector.instantiate = function diInstantiateWrapper<T>(this: angular.auto.IInjectorService, typeConstructor: TypeFacade<T>, locals: any): T {
        return instantiate.call(this, injectMethod(typeConstructor), locals);
    };

    // invoke(inlineAnnotatedFunction: any[]): any;
    // invoke(func: Function, context?: any, locals?: any): any;
    injector.invoke = function diInvokeWrapper(this: angular.auto.IInjectorService, thing: TypeFacade<any>, ...args: any[]) {
        return invoke.call(this, injectMethod(thing), ...args);
    };

    return injector;
}]);

// Decorate (at config) the AngularJS $provide to allow non-string IDs.
// Follow the Types + arguments declared in @types definition + the ng-facade overrides
module("ng").config(["$provide", function(provide: angular.auto.IProvideService): void {
    ["constant", "value", "factory", "provider", "service"].forEach(function(method) {
        const delegate = provide[method];

        function diProvideWrapper(this: angular.auto.IProvideService, key: string | TypeFacade<any>, value: Function | any | any[]): angular.IServiceProvider;
        function diProvideWrapper(this: angular.auto.IProvideService, key: string | TypeFacade<any>, value: angular.IServiceProvider): angular.IServiceProvider;
        function diProvideWrapper(this: angular.auto.IProvideService, multi: {key: string, value: any}): void;

        function diProvideWrapper(this: angular.auto.IProvideService, key: string | TypeFacade<any> | {key: string, value: any}, value?: Function | angular.IServiceProvider | any[]): angular.IServiceProvider | void {
            if (arguments.length === 1) {
                return delegate(key);
            }
            else {
                return delegate(toTypeName(<string | TypeFacade<any>>key), <Function | any | any[]>value);
            }
        }

        provide[method] = diProvideWrapper;
    });

    const decorator = provide.decorator;

    // decorator(type: TypeFacade<any>, decorator: Function): void;
    // decorator(type: TypeFacade<any>, inlineAnnotatedFunction: any[]): void;
    provide.decorator = function diDecorator(this: angular.auto.IProvideService, type: TypeFacade<any> | string, dec: Function | any[]): void {
        decorator.call(this, toTypeName(type), dec);
    };
}]);