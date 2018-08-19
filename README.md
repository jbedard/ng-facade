# ng-facade

Angular es6 annotations for AngularJS. Attemps to be a close as possible to Angular in syntax and functionality.



# InjectableFacade, InjectFacade

Classes marked with `@InjectableFacade()` can:
* be placed anywhere a traditional service string name is placed
* use `@InjectFacade('serviceName')` to inject traditional services by string name
* inject other `@InjectableFacade()` services by TypeScript type in the constructor


```typescript
import {InjectableFacade, InjectFacade, NgModuleFacade} from "ng-facade";

@InjectableFacade()
class Logger {
    constructor(
        //Injection of non ng-facade services
        @InjectFacade("$http") private http,

        //Injection of ng-facade style services
        private otherService: OtherService
    )

    public log(msg: string) { ... }
}

@InjectableFacade()
class OtherService {}

@NgModuleFacade({
    id: "demo",
    providers: [Logger, OtherService]
})
class MyModule {}
```


# $injector

```typescript
@InjectableFacade()
class Service {
}

@NgModuleFacade({id: "test", providers: [Service]})
class Mod {}

...

$injector.has(Service);     //=> true
$injector.get(Service);     //=> the Service instance

const instance1 = $injector.instantiate(Service);
const instance2 = $injector.instantiate(Service);
instance1 == instance2;     //=> false


//To reference Angular/ng-facade style classes from AngularJS style injection
$injector.invoke(["$rootScope", Service, function($rootScope, serv) { ... }]);

module.run(["$rootScope", Service, function($rootScope, serv) { ... }])

module.service("ServiceName", ["$rootScope", Service, function ServiceClass() {
    constructor($rootScope, serv) { ... }
]);

```



# NgModule

```typescript
import {NgModuleFacade} from "ng-facade";

@NgModuleFacade({
    id: "my-module",

    imports: [
        "otherModule",
        angular.module("mydep"),            //importing AngularJS modules
        otherNgModule                       //importing @NgModule modules
    ],

    providers: [
        //TypeProviderFacade
        InjectableClass,

        //FactoryProviderFacade
        {
            provide: Provided,
            useFactory: function() { return ... }
        },

        //FactoryProviderFacade + use
        {
            provide: Provided,
            useFactory: function(AngularJSService, service: ServiceClass) { return ... }
            use: [
                "AngularJSService",
                ServiceClass
            ]
        },

        //ExistingProviderFacade
        SuperLogger,
        {
            provide: Logger
            useExisting: SuperLogger
        },

        //ClassProviderFacade
        {
            provide: Provided,
            useClass: ProvidedImpl
        },

        //PipeTransformFacade (ClassProviderFacade)
        MyPipe
    ],

    declarations: [Component, Directive, ...]
})
class MyModule {}
```



# ComponentFacade, DirectiveFacade

`@ComponentFacade` and `@DirectiveFacade` annotations can be used to declare component/directives. The classes must then be passed to the `@NgModuleFacade` `declarations`.


```typescript
@ComponentFacade({
    selector: "comp-selector",

    //Optional
    template: "...",

    transclude: ...,
    controllerAs: ...
})
class Comp {}


@DirectiveFacade({
    selector: "element" | ".class" | "[attribute]"
})
class Dir {}


@NgModuleFacade({id: "compMod", declarations: [Comp, Dir]})
class Mod {}
```



# PipeFacade, PipeTransformFacade

```typescript
import {PipeFacade, PipeTransformFacade, NgModuleFacade} from "ng-facade";

@PipeFacade({name: "myPipe"})
class MyPipe implements PipeTransformFacade {
    transform(x, y) { return x + y; }
}

@NgModuleFacade({id: "pipeMod", providers: [P]})
class Mod {}

@NgModuleFacade({
    id: "demo",
    providers: [MyPipe]
})
class MyModule {}
```

```html
<span>{{myX | myPipe:myY}}</span>
```



# @InputFacade, @InputStringFacade, @InputCallbackFacade



# @OutputFacade, EventEmitterFacade



# @RequireFacade



# @HostListenerFacade