import "jasmine";
import "tslib";
import * as angular from "angular";

import {Inject, Injectable, PipeTransform, Pipe, Input, InputString, InputCallback, Require, Directive, Component, NgModule} from "./facade";

describe("facade", function() {
    const toDestroy = [];
    function bootstrap(mod) {
        const $test = document.createElement("div");

        toDestroy.push($test);

        angular.bootstrap($test, [mod], {
            strictDi: true
        });

        return angular.module(mod);
    }
    afterEach(function() {
        angular.element(toDestroy.splice(0)).remove();
    });

    function bootstrapAndInitialize(mod, what) {
        let ref;
        angular.module(mod).run([what, function(thing) { ref = thing; }]);
        bootstrap(mod);
        return ref;
    }

    function createMockModule() {
        const mockModule = {
            name: undefined,
            run: jasmine.createSpy("run"),
            service: jasmine.createSpy("service"),
            factory: jasmine.createSpy("factory"),
            directive: jasmine.createSpy("directive"),
            component: jasmine.createSpy("component"),
            filter: jasmine.createSpy("filter")
        };

        const module = spyOn(angular, "module").and.callFake(function(name) {
            mockModule.name = name;
            return mockModule;
        });

        return angular.extend({module}, mockModule);
    }

    describe("NgModule", function() {
        it("should invoke angular.module(id, [])", function() {
            const spies = createMockModule();

            @NgModule({
                id: "foo"
            })
            class Mod {}

            expect(spies.module).toHaveBeenCalledWith("foo", []);
        });

        it("should invoke constructor on init", function() {
            const spies = createMockModule();

            @NgModule({
                id: "bar"
            })
            class Mod {}

            expect(spies.module).toHaveBeenCalledWith("bar", []);
            expect(spies.run).toHaveBeenCalledWith(Mod);
        });

        it("should pass imports angular.module(id, [modules])", function() {
            const spies = createMockModule();

            @NgModule({
                id: "foo",
                imports: ["mydep"]
            })
            class FooMod {}

            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support passing angular modules as imports)", function() {
            const spies = createMockModule();

            @NgModule({
                id: "mydep"
            })
            class DepMod {}

            @NgModule({
                id: "foo",
                imports: [angular.module("mydep")]
            })
            class FooMod {}

            expect(spies.module).toHaveBeenCalledWith("mydep", []);
            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support passing @NgModule() classes as imports)", function() {
            const spies = createMockModule();

            @NgModule({
                id: "mydep"
            })
            class DepMod {}

            @NgModule({
                id: "foo",
                imports: [DepMod]
            })
            class FooMod {}

            expect(spies.module).toHaveBeenCalledWith("mydep", []);
            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support providers with plain classes", function() {
            const spies = createMockModule();

            @Injectable()
            class Foo {}

            @NgModule({
                id: "test", providers: [Foo]
            })
            class Mod {}

            expect(spies.service).toHaveBeenCalledWith((<any>Foo).$$name, Foo);
        });

        it("should support providers with useFactory factory", function() {
            @Injectable()
            class Foo {}

            let theNewFoo;

            @NgModule({
                id: "test", providers: [{provide: Foo, useFactory() { return theNewFoo = new Foo(); }}]
            })
            class Mod {}

            const instance = bootstrapAndInitialize("test", Foo);

            expect(instance).toBe(theNewFoo);
        });

        it("should support providers with useExisting reference", function() {
            @Injectable()
            class Foo {}

            @Injectable()
            class Bar {}

            @NgModule({
                id: "test", providers: [Foo, {provide: Bar, useExisting: Foo}]
            })
            class Mod {}

            const $injector = bootstrapAndInitialize("test", "$injector");

            expect($injector.get(Bar)).toBe($injector.get(Foo));
        });

        it("should support providers with useClass reference", function() {
            @Injectable()
            class Foo {}

            @Injectable()
            class Bar extends Foo {}

            @NgModule({
                id: "test", providers: [{provide: Foo, useClass: Bar}]
            })
            class Mod {}

            const $injector = bootstrapAndInitialize("test", "$injector");

            expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
        });

        it("should throw for provider.multi", function() {
            expect(function() {
                @NgModule({
                    id: "multiMod", providers: [{multi: true}]
                })
                class Mod {}
            })
            .toThrowError("Provider.multi unsupported");
        });

        it("should throw for unsupported provider types", function() {
            expect(function() {
                @NgModule({
                    id: "badProviderMod", providers: ["arr"]
                })
                class Mod {}
            })
            .toThrow();
        });

        it("should throw for unsupported declaration types", function() {
            expect(function() {
                @NgModule({
                    id: "badDeclarationsMod",
                    declarations: [class C {}]
                })
                class Mod {}
            })
            .toThrow();
        });

        it("should delegate @Pipe({name}) to module.filter(name, [$injector, factory])", function() {
            const modSpies = createMockModule();

            @Pipe({name: "myPipe"})
            class P implements PipeTransform {
                transform(x) { return x; }
            }

            @NgModule({id: "pipeMod", providers: [P]})
            class Mod {}

            expect(modSpies.filter).toHaveBeenCalledWith("myPipe", ["$injector", jasmine.any(Function)]);
        });
    });

    describe("@Pipe", function() {
        it("should invoke @Pipe() constructor when invoking filter factory", function() {
            const constructorSpy = jasmine.createSpy("constructor");

            @Pipe({name: "myPipe"})
            class P implements PipeTransform {
                constructor() {
                    constructorSpy.apply(this, arguments);
                }
                transform(x) { return x; }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            expect(constructorSpy).not.toHaveBeenCalled();
            bootstrapAndInitialize("test", "myPipeFilter");
            expect(constructorSpy).toHaveBeenCalledWith();
        });

        it("should invoke @Pipe() constructor with @Inject() params invoking filter factory", function() {
            const constructorSpy = jasmine.createSpy("constructor");

            @Pipe({name: "myPipe"})
            class P implements PipeTransform {
                constructor(@Inject("$q") foobar, @Inject("$q") private other) {
                    constructorSpy.apply(this, arguments);
                }
                transform(x) { return x; }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            expect(constructorSpy).not.toHaveBeenCalled();
            bootstrapAndInitialize("test", "myPipeFilter");
            expect(constructorSpy).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Function));

            const [arg0, arg1] = constructorSpy.calls.mostRecent().args;
            expect(arg0.when).toEqual(jasmine.any(Function));
            expect(arg1).toBe(arg0);
        });

        it("should convert class P { transform() } to a P-instance bound filter method", function() {
            const transformSpy = jasmine.createSpy("transform");

            @Pipe({name: "noPure"})
            class P implements PipeTransform {
                transform() {
                    transformSpy.apply(this, arguments);
                }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            const myPipe = bootstrapAndInitialize("test", "noPureFilter");

            myPipe(1,2,3);

            expect(transformSpy.calls.mostRecent().object instanceof P);
            expect(transformSpy).toHaveBeenCalledWith(1,2,3);
        });

        it("should default @Pipe() to non-$stateful", function() {
            @Pipe({name: "noPure"})
            class P implements PipeTransform {
                transform(x) { return x; }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            const noPure = bootstrapAndInitialize("test", "noPureFilter");
            expect(noPure.$stateful).toBe(false);
        });

        it("should convert @Pipe({pure: true}) to non-$stateful", function() {
            @Pipe({name: "pureTrue", pure: true})
            class P implements PipeTransform {
                transform(x) { return x; }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            const pureTrue = bootstrapAndInitialize("test", "pureTrueFilter");
            expect(pureTrue.$stateful).toBe(false);
        });

        it("should convert @Pipe({pure: false}) to $stateful", function() {
            @Pipe({name: "pureFalse", pure: false})
            class P implements PipeTransform {
                transform(x) { return x; }
            }

            @NgModule({id: "test", providers: [P]})
            class Mod {}

            const pureFalse = bootstrapAndInitialize("test", "pureFalseFilter");
            expect(pureFalse.$stateful).toBe(true);
        });
    });

    describe("@Injectable", function() {
        it("should go on classes even though it doesn't do anything", function() {
            @Injectable()
            class Foo {}

            expect(Foo).toBeDefined();
        });

        it("should be required when providing a service to NgModule", function() {
            class Foo {}
            @NgModule({id: "test", providers: [Foo]})
            class Mod {}
            expect(function() { bootstrapAndInitialize("test", Foo); }).toThrow();
        });

        it("should inject via TypeScript types", function m() {
            @Injectable()
            class Foo {}

            @Injectable()
            class Bar {
                constructor(private f: Foo) {}
            }

            @NgModule({id: "test", providers: [Foo, Bar]})
            class Mod {}

            const bar = bootstrapAndInitialize("test", Bar);

            expect(bar.f).toEqual(jasmine.any(Foo));
        });

        it("should inject other services via @Inject('thing')", function() {
            @Injectable()
            class Foo {
                constructor(@Inject("$rootScope") private theScope) {}
            }

            @NgModule({id: "test", providers: [Foo]})
            class Mod {}

            const bar = bootstrapAndInitialize("test", Foo);

            expect(bar.theScope).not.toBeUndefined();
            expect(bar.theScope.$apply).toEqual(jasmine.any(Function));
        });

        it("should inject via TypeScript types on private/public fields and params", function() {
            @Injectable()
            class Foo {}

            @Injectable()
            class Bar {
                constructor(public f: Foo) {}
            }

            @Injectable()
            class Baz {
                constructor(private b: Bar, f: Foo) {
                    expect(f).toBe(this.b.f);
                }
            }

            @NgModule({id: "test", providers: [Foo, Bar, Baz]})
            class Mod {}

            const baz = bootstrapAndInitialize("test", Baz);

            expect(baz.b).toEqual(jasmine.any(Bar));
        });

        it("should inject mix of @Inject('thing') and via TypeScript types", function() {
            @Injectable()
            class Foo {}

            @Injectable()
            class Bar {
                constructor(public f: Foo, @Inject("$rootScope") public s) {}
            }

            @NgModule({id: "test", providers: [Foo, Bar]})
            class Mod {}

            const bar = bootstrapAndInitialize("test", Bar);

            expect(bar.f).toEqual(jasmine.any(Foo));
            expect(bar.s.$apply).toEqual(jasmine.any(Function));
        });
    });

    describe("@Inject", function() {
        it("should fill the $inject array based on constructor @Inject arguments", function() {
            class Foo {
                constructor(@Inject("foo") private myFoo, other, @Inject("bar") public myBar) {}
            }

            expect(Foo.$inject).toEqual(["foo", undefined, "bar"]);
        });
    });

    describe("$injector", function() {
        describe("get/has", function() {
            it("should convert types to name when invoking has/get", function() {
                @Injectable()
                class Service {
                }

                class NotService {}

                @NgModule({id: "test", providers: [Service]})
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.has(NotService)).toBe(false);
                expect($injector.has(Service)).toBe(true);
                expect($injector.get(Service)).toEqual(jasmine.any(Service));
                expect(function() { $injector.get(NotService); }).toThrow();
            });
        });

        describe("instantiate", function() {
            it("should support passing types", function() {
                @Injectable()
                class Service {
                }

                @NgModule({id: "test", providers: [Service]})
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                let instance1 = $injector.instantiate(Service);
                let instance2 = $injector.instantiate(Service);

                expect(instance1).toEqual(jasmine.any(Service));
                expect(instance2).toEqual(jasmine.any(Service));
                expect(instance1).not.toBe(instance2);
            });
        });

        describe("invoke", function() {
            it("should support passing types in the [..., func] $inject array", function() {
                @Injectable()
                class Service {
                }

                @NgModule({id: "test", providers: [Service]})
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                let instance;
                $injector.invoke(["$rootScope", Service, function($rootScope, serv) {
                    instance = serv;
                }]);

                expect(instance).toEqual(jasmine.any(Service));
            });

            it("should support passing types in the func.$inject array", function() {
                @Injectable()
                class Service {
                }

                @NgModule({id: "test", providers: [Service]})
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                let instance;
                function method($rootScope, serv) {
                    instance = serv;
                }
                (<any>method).$inject = ["$rootScope", Service];
                $injector.invoke(method);

                expect(instance).toEqual(jasmine.any(Service));
            });
        });
    });

    describe("@Component", function() {
        it("should delegate @Component() in @NgModule{declarations} to module.component", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp-selector"
            })
            class Comp {}

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("compSelector", jasmine.objectContaining({controller: Comp}));
        });

        it("should convert @Input() fields to module.component <? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Input()
                public inputName;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {inputName: "<?"}, controller: Comp}));
        });

        it("should convert @Input('altName') fields to module.component aliased <? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Input("altName")
                public inputName;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {inputName: "<?altName"}, controller: Comp}));
        });

        it("should convert @InputString() fields to module.component @? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @InputString()
                public inputName;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {inputName: "@?"}, controller: Comp}));
        });

        it("should convert @InputCallback() fields to module.component &? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @InputCallback()
                public inputName;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {inputName: "&?"}, controller: Comp}));
        });

        it("should convert @Require() fields to module.component require with same name as field", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Require()
                public requirement;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({require: {requirement: "requirement"}, controller: Comp}));
        });

        it("should convert @Require('^') fields to module.component require with same name as field", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Require("^")
                public requirement;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({require: {requirement: "^requirement"}, controller: Comp}));
        });

        it("should convert @Require('publicName') fields to module.component require", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Require("publicName")
                public requirement;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({require: {requirement: "publicName"}, controller: Comp}));
        });

        it("should convert @Require('^^publicName') fields to module.component require", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp"
            })
            class Comp {
                @Require("^^publicName")
                public requirement;
            }

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({require: {requirement: "^^publicName"}, controller: Comp}));
        });

        it("should convert @Component inputs[] declarations to module.component <? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp",
                inputs: ["a", "b"]
            })
            class Comp {}

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {a: "<?", b: "<?"}, controller: Comp}));
        });

        it("should convert @Component inputs[] declarations with aliases to module.component <? bindings", function() {
            const spies = createMockModule();

            @Component({
                selector: "comp",
                inputs: ["a: foo ", " b : bar"]
            })
            class Comp {}

            @NgModule({id: "compMod", declarations: [Comp]})
            class Mod {}

            expect(spies.component).toHaveBeenCalledWith("comp", jasmine.objectContaining({bindings: {a: "<?foo", b: "<?bar"}, controller: Comp}));
        });
    });

    describe("@Directive", function() {
        function getMockedDirective(spies) {
            expect(spies.directive).toHaveBeenCalled();

            const args = spies.directive.calls.mostRecent().args;

            return {
                name: args[0],
                factory: args[1]
            };
        }

        it("should delegate @Directive() in @NgModule{declarations} to module.directive", function() {
            const spies = createMockModule();

            @Directive({
                selector: "dir-selector"
            })
            class Dir {}

            @NgModule({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("dirSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "E", controller: Dir}));
        });

        it("should support attribute selectors", function() {
            const spies = createMockModule();

            @Directive({
                selector: "[dir-selector]"
            })
            class Dir {}

            @NgModule({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("dirSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "A", controller: Dir}));
        });

        it("should support class selectors", function() {
            const spies = createMockModule();

            @Directive({
                selector: ".cls-selector"
            })
            class Dir {}

            @NgModule({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("clsSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "C", controller: Dir}));
        });

        describe("unsupported", function() {
            it("should throw when using @Input", function() {
                @Directive({
                    selector: "dir"
                })
                class Dir {
                    @Input() public foo;
                }

                expect(function() {
                    @NgModule({id: "compMod", declarations: [Dir]})
                    class Mod {}
                })
                .toThrow();
            });

            it("should throw when using inputs[]", function() {
                @Directive({
                    selector: "dir",
                    inputs: ["a"]
                })
                class Dir {}

                expect(function() {
                    @NgModule({id: "compMod", declarations: [Dir]})
                    class Mod {}
                })
                .toThrow();
            });
        });
    });

    it("should not use raw function names as angular service names", function() {
        @Injectable()
        class Service {
        }

        @NgModule({id: "test", providers: [Service]})
        class Mod {}

        const $injector = bootstrapAndInitialize("test", "$injector");

        expect($injector.has("Service")).toBe(false);
        expect($injector.has(Service)).toBe(true);
    });

    it("should use raw function names when running alongside angular-mock", function() {
        spyOn(window, "angular");
        window["angular"].mock = {};

        @Injectable()
        class Service {
        }

        @NgModule({id: "test", providers: [Service]})
        class Mod {}

        const $injector = bootstrapAndInitialize("test", "$injector");

        expect($injector.has("Service")).toBe(true);
        expect($injector.has(Service)).toBe(true);
        expect($injector.get("Service")).toBe($injector.get(Service));
    });
});