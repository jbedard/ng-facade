# ng-facade

Angular es6 annotations for AngularJS. Attemps to be a close as possible to Angular in syntax and functionality.



# Injectable, Inject

```typescript
import {Injectable, Inject, NgModule} from "ng-facade";

@Injectable()
class Logger {
    constructor(
        //Injection of non ng-facade services
        @Inject("$http") private http,

        //Injection of ng-facade style services
        private otherService: OtherService
    )

    public log(msg: string) { ... }
}

@Injectable()
class OtherService {}

@NgModule({
    id: "demo",
    providers: [Logger, OtherService]
})
class MyModule {}
```


# $injector

```typescript
@Injectable()
class Service {
}

@NgModule({id: "test", providers: [Service]})
class Mod {}

...

$injector.has(Service);     //=> true
$injector.get(Service);     //=> the Service instance

const instance1 = $injector.instantiate(Service);
const instance2 = $injector.instantiate(Service);
instance1 == instance2;     //=> false


//To reference Angular/ng-facade style classes from AngularJS style injection
$injector.invoke(["$rootScope", Service, function($rootScope, serv) { ... }]);

```



# NgModule

```typescript
import {NgModule} from "ng-facade";

@NgModule({
    id: "my-module",

    imports: [
        "otherModule",
        angular.module("mydep"),            //importing AngularJS modules
        otherNgModule                       //importing @NgModule modules
    ],

    providers: [
        //TypeProvider
        InjectableClass,

        //FactoryProvider
        {
            provide: Provided,
            useFactory: function() { return ... }
        },

        //FactoryProvider + use
        {
            provide: Provided,
            useFactory: function(AngularJSService, service: ServiceClass) { return ... }
            use: [
                "AngularJSService",
                ServiceClass
            ]
        },

        //ExistingProvider
        SuperLogger,
        {
            provide: Logger
            useExisting: SuperLogger
        },

        //ClassProvider
        {
            provide: Provided,
            useClass: ProvidedImpl
        },

        //PipeTransform (ClassProvider)
        MyPipe
    ],

    declarations: [Component, Directive, ...]
})
class MyModule {}
```



# Pipe, PipeTransform

```typescript
import {Pipe, PipeTransform, NgModule} from "ng-facade";

@Pipe({name: "myPipe"})
class MyPipe implements PipeTransform {
    transform(x, y) { return x + y; }
}

@NgModule({id: "pipeMod", providers: [P]})
class Mod {}

@NgModule({
    id: "demo",
    providers: [MyPipe]
})
class MyModule {}
```

```html
<span>{{myX | myPipe:myY}}</span>
```
