import "jasmine";
import "tslib";
import "reflect-metadata";
import * as angular from "angular";
import "angular-mocks";

import { InjectFacade, InjectableFacade, PipeTransformFacade, PipeFacade, ProviderFacade, InputFacade, InputStringFacade, InputCallbackFacade, OutputFacade, EventEmitterFacade, RequireFacade, DirectiveFacade, ComponentFacade, HostListenerFacade, NgModuleFacade, TypeFacade, OnInitFacade, OnChangesFacade, OnDestroyFacade, DoCheckFacade } from "./facade";
import "./facade-mocks";

//Copied from facade.ts to avoid exposing publicly
const OUTPUT_BOUND_CALLBACK_PREFIX = "__event_";

describe("facade", function() {
    const toDestroy: HTMLElement[] = [];
    function bootstrap(mod: string | angular.IModule) {
        const modName = typeof mod === "string" ? mod : mod.name;
        const $test = document.createElement("div");

        toDestroy.push($test);

        angular.bootstrap($test, [modName], {
            strictDi: true
        });

        return angular.module(modName);
    }
    afterEach(function() {
        angular.element(toDestroy.splice(0)).remove();
    });

    function bootstrapAndInitialize<T>(mod: string | angular.IModule, what: TypeFacade<T>): T;
    function bootstrapAndInitialize(mod: string | angular.IModule, what: any): any;
    function bootstrapAndInitialize(mod: string | angular.IModule, what: any) {
        const modName = typeof mod === "string" ? mod : mod.name;
        let ref;
        angular.module(modName).run([what, function(thing: any) { ref = thing; }]);
        bootstrap(modName);
        return ref;
    }

    function bootstrapAndCompile(mod: string, html: string, scopeData = {}) {
        const $injector: angular.auto.IInjectorService = bootstrapAndInitialize("compMod", "$injector");
        const $compile = $injector.get("$compile");
        const $rootScope = $injector.get("$rootScope");

        const $scope = $rootScope.$new();
        angular.extend($scope, scopeData);

        const $dom = $compile(html)($scope);

        $rootScope.$digest();

        return {$scope, $dom, $injector, $rootScope};
    }

    function expectDirectiveDefinitionCall(spies, nameExpectation, definitionExpectation) {
        expect(spies.directive).toHaveBeenCalled();

        const [name, factory] = spies.directive.calls.mostRecent().args;

        expect(name).toEqual(nameExpectation);
        expect(factory.length).toBe(2);
        expect(factory[0]).toBe("$injector");
        expect(factory[1]()).toEqual(definitionExpectation);
    }

    function createMockModule(): {module: angular.IModule & jasmine.Spy} & angular.IModule {
        const mockModule = {
            name: undefined,
            run: jasmine.createSpy("run"),
            service: jasmine.createSpy("service"),
            factory: jasmine.createSpy("factory"),
            directive: jasmine.createSpy("directive"),
            filter: jasmine.createSpy("filter")
        };

        const module = spyOn(angular, "module").and.callFake(function(name) {
            mockModule.name = name;
            return mockModule;
        });

        return angular.extend({module}, mockModule);
    }

    describe("NgModuleFacade", function() {
        it("should invoke angular.module(id, [])", function() {
            const spies = createMockModule();

            @NgModuleFacade({
                id: "foo"
            })
            class Mod {}

            expect(spies.module).toHaveBeenCalledWith("foo", []);
        });

        it("should invoke constructor on init", function() {
            const spies = createMockModule();

            @NgModuleFacade({
                id: "bar"
            })
            class Mod {}

            expect(spies.module).toHaveBeenCalledWith("bar", []);
            expect(spies.run).toHaveBeenCalledWith(Mod);
        });

        it("should pass imports angular.module(id, [modules])", function() {
            const spies = createMockModule();

            @NgModuleFacade({
                id: "foo",
                imports: ["mydep"]
            })
            class FooMod {}

            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support passing angular modules as imports)", function() {
            const spies = createMockModule();

            @NgModuleFacade({
                id: "mydep"
            })
            class DepMod {}

            @NgModuleFacade({
                id: "foo",
                imports: [angular.module("mydep")]
            })
            class FooMod {}

            expect(spies.module).toHaveBeenCalledWith("mydep", []);
            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support passing @NgModuleFacade() classes as imports)", function() {
            const spies = createMockModule();

            @NgModuleFacade({
                id: "mydep"
            })
            class DepMod {}

            @NgModuleFacade({
                id: "foo",
                imports: [DepMod]
            })
            class FooMod {}

            expect(spies.module.calls.count()).toBe(2);
            expect(spies.module).toHaveBeenCalledWith("mydep", []);
            expect(spies.module).toHaveBeenCalledWith("foo", ["mydep"]);
        });

        it("should support providers with plain classes", function() {
            const spies = createMockModule();

            @InjectableFacade()
            class Foo {}

            @NgModuleFacade({
                id: "test", providers: [Foo]
            })
            class Mod {}

            expect(spies.service).toHaveBeenCalledWith(jasmine.any(String), Foo);
        });

        //NOTE: this may be stricter then Angular where @InjectableFacade is optional
        it("should throw if a plain-class provider is not marked as InjectableFacade", function() {
            class Foo {}

            @NgModuleFacade({
                id: "test", providers: [Foo]
            })
            class Mod {}

            expect(function() {
                bootstrapAndInitialize("test", Foo);
            })
            .toThrow();
        });

        describe("useFactory", function() {
            it("should invoke factory", function() {
                class Foo {}

                let theNewFoo;

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useFactory() { return theNewFoo = new Foo(); }}]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Foo);

                expect(instance).toBe(theNewFoo);
                expect(instance).toEqual(jasmine.any(Foo));
            });

            it("should support any key object", function() {
                const Foo = {};

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useFactory() { return 123; }}]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Foo);

                expect(instance).toBe(123);
            });

            it("should support InjectableFacade provider", function() {
                @InjectableFacade()
                class Foo {}

                let theNewFoo;

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useFactory() { return theNewFoo = new Foo(); }}]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Foo);

                expect(instance).toBe(theNewFoo);
                expect(instance).toEqual(jasmine.any(Foo));
            });

            it("should support deps to inject into factory method", function() {
                @InjectableFacade()
                class Foo {}

                class Bar {
                    constructor(public a, public b) {}
                }

                @NgModuleFacade({
                    id: "test",
                    providers: [Foo, {
                        provide: Bar,
                        useFactory(a, b) { return new Bar(a, b); },
                        deps: ["$rootScope", Foo]
                    }]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Bar);

                expect(instance).toEqual(jasmine.any(Bar));
                expect("$apply" in instance.a).toBe(true);
                expect(instance.b).toEqual(jasmine.any(Foo));
            });

            it("should support deps to inject into factory method declared out of order", function() {
                @InjectableFacade()
                class Foo {}

                class Bar {
                    constructor(public a, public b) {}
                }

                @NgModuleFacade({
                    id: "test",
                    providers: [{
                        provide: Bar,
                        useFactory(a, b) { return new Bar(a, b); },
                        deps: ["$rootScope", Foo]
                    }, Foo]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Bar);

                expect(instance).toEqual(jasmine.any(Bar));
                expect("$apply" in instance.a).toBe(true);
                expect(instance.b).toEqual(jasmine.any(Foo));
            });

            it("should support factory.$inject to inject into factory method", function() {
                @InjectableFacade()
                class Foo {}

                class Bar {
                    constructor(public a, public b) {}
                }

                function factory(a, b) { return new Bar(a, b); }
                (<any>factory).$inject = ["$rootScope", Foo];

                @NgModuleFacade({
                    id: "test",
                    providers: [Foo, {
                        provide: Bar,
                        useFactory: factory
                    }]
                })
                class Mod {}

                const instance = bootstrapAndInitialize("test", Bar);

                expect(instance).toEqual(jasmine.any(Bar));
                expect("$apply" in instance.a).toBe(true);
                expect(instance.b).toEqual(jasmine.any(Foo));
            });

            it("should throw if both factory.$inject and deps declared", function() {
                @InjectableFacade()
                class Foo {}

                class Bar {
                    constructor(public a, public b) {}
                }

                function factory(a, b) { return new Bar(a, b); }
                (<any>factory).$inject = ["$rootScope", Foo];

                expect(function() {
                    @NgModuleFacade({
                        id: "test",
                        providers: [Foo, {
                            provide: Bar,
                            useFactory: factory,
                            deps: ["$rootScope", Foo]
                        }]
                    })
                    class Mod {}
                })
                .toThrow();
            });
        });

        describe("useExisting", function() {
            it("should reference existing InjectableFacade", function() {
                @InjectableFacade()
                class Foo {}

                @InjectableFacade()
                class Bar {}

                @NgModuleFacade({
                    id: "test", providers: [Foo, {provide: Bar, useExisting: Foo}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Bar)).toBe($injector.get(Foo));
            });

            it("should support any key", function() {
                @InjectableFacade()
                class Foo {}

                const Bar = {};

                @NgModuleFacade({
                    id: "test", providers: [Foo, {provide: Bar, useExisting: Foo}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Bar)).toBe($injector.get(Foo));
            });

            it("should support declared out of order", function() {
                @InjectableFacade()
                class Foo {}

                const Bar = {};

                @NgModuleFacade({
                    id: "test", providers: [{provide: Bar, useExisting: Foo}, Foo]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Bar)).toBe($injector.get(Foo));
            });

            it("should throw if existing not found", function() {
                class Foo {}

                class Bar {}

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useExisting: Bar}]
                })
                class Mod {}

                expect(function() {
                    bootstrapAndInitialize("test", Foo);
                })
                .toThrow();
            });
        });

        describe("useClass", function() {
            it("should be supported", function() {
                @InjectableFacade()
                class Foo {}

                @InjectableFacade()
                class Bar extends Foo {}

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useClass: Bar}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
            });

            it("should create a new instance", function() {
                @InjectableFacade()
                class Foo {}

                @InjectableFacade()
                class Bar extends Foo {}

                @NgModuleFacade({
                    id: "test", providers: [Bar, {provide: Foo, useClass: Bar}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Bar)).toEqual(jasmine.any(Bar));
                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
                expect($injector.get(Bar)).not.toBe($injector.get(Foo));
            });

            it("should support any key", function() {
                const Foo = {};

                class Bar {}

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useClass: Bar}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
            });

            it("should support injection into used class", function() {
                @InjectableFacade()
                class Baz {}

                class Foo {}

                @InjectableFacade()
                class Bar extends Foo {
                    constructor(public baz: Baz) { super(); }
                }

                @NgModuleFacade({
                    id: "test", providers: [Baz, {provide: Foo, useClass: Bar}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
                expect($injector.get(Foo).baz).toEqual(jasmine.any(Baz));
            });

            it("should support injection into used class when declared out of order", function() {
                @InjectableFacade()
                class Baz {}

                class Foo {}

                @InjectableFacade()
                class Bar extends Foo {
                    constructor(public baz: Baz) { super(); }
                }

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useClass: Bar}, Baz]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
                expect($injector.get(Foo).baz).toEqual(jasmine.any(Baz));
            });

            //NOTE: this may be stricter then Angular where @InjectableFacade is optional
            it("should throw when trying to inject into non-@InjectableFacade useClass", function() {
                @InjectableFacade()
                class Baz {}

                class Foo {}

                class Bar extends Foo {
                    constructor(public baz: Baz) { super(); }
                }

                @NgModuleFacade({
                    id: "test", providers: [Baz, {provide: Foo, useClass: Bar}]
                })
                class Mod {}

                expect(function() {
                    bootstrapAndInitialize("test", Bar);
                })
                .toThrow();
            });
        });

        describe("useValue", function() {
            it("should be supported", function() {
                class Foo {}

                const key = Foo;
                const value = new Foo();

                @NgModuleFacade({
                    id: "test", providers: [{provide: key, useValue: value}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(key)).toBe(value);
            });

            it("should support any key", function() {
                const key = {};
                const value = 42;

                @NgModuleFacade({
                    id: "test", providers: [{provide: key, useValue: value}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(key)).toBe(value);
            });

            it("should support injection into used class", function() {
                class Foo {}

                class Bar extends Foo {
                }

                @NgModuleFacade({
                    id: "test", providers: [{provide: Foo, useValue: new Bar()}]
                })
                class Mod {}

                const $injector = bootstrapAndInitialize("test", "$injector");

                expect($injector.get(Foo)).toEqual(jasmine.any(Bar));
            });
        });

        it("should throw for unsupported declaration types", function() {
            expect(function() {
                @NgModuleFacade({
                    id: "badDeclarationsMod",
                    declarations: [class C {}]
                })
                class Mod {}
            })
            .toThrow();
        });

        it("should delegate @PipeFacade({name}) to module.filter(name, [PipeTransformFacade, factory])", function() {
            const modSpies = createMockModule();

            @PipeFacade({name: "myPipe"})
            class P implements PipeTransformFacade {
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "pipeMod", providers: [P]})
            class Mod {}

            expect(modSpies.filter).toHaveBeenCalledWith("myPipe", [P, jasmine.any(Function)]);
        });
    });

    describe("@PipeFacade", function() {
        it("should invoke @PipeFacade() constructor when invoking filter factory", function() {
            const constructorSpy = jasmine.createSpy("constructor");

            @PipeFacade({name: "myPipe"})
            class P implements PipeTransformFacade {
                constructor() {
                    constructorSpy.apply(this, arguments);
                }
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            expect(constructorSpy).not.toHaveBeenCalled();
            bootstrapAndInitialize("test", "myPipeFilter");
            expect(constructorSpy).toHaveBeenCalledWith();
        });

        it("should invoke @PipeFacade() constructor with @InjectFacade() params invoking filter factory", function() {
            const constructorSpy = jasmine.createSpy("constructor");

            @PipeFacade({name: "myPipe"})
            class P implements PipeTransformFacade {
                constructor(@InjectFacade("$q") foobar, @InjectFacade("$q") private other) {
                    constructorSpy.apply(this, arguments);
                }
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            expect(constructorSpy).not.toHaveBeenCalled();
            bootstrapAndInitialize("test", "myPipeFilter");
            expect(constructorSpy).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Function));

            const [arg0, arg1] = constructorSpy.calls.mostRecent().args;
            expect(arg0.when).toEqual(jasmine.any(Function));
            expect(arg1).toBe(arg0);
        });

        it("should be InjectableFacade", function() {
            @PipeFacade({name: "myPipe"})
            class P implements PipeTransformFacade {
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const instance = bootstrapAndInitialize("test", P);

            expect(instance).toEqual(jasmine.any(P));
        });

        it("should convert class P { transform() } to a $filter method", function() {
            const transformSpy = jasmine.createSpy("transform");

            @PipeFacade({name: "resultPipe"})
            class P implements PipeTransformFacade {
                transform(...args) {
                    return args.reduce((t, x) => t + x, 0);
                }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const myPipe = bootstrapAndInitialize("test", "resultPipeFilter");

            expect(myPipe()).toBe(0);
            expect(myPipe(1)).toBe(1);
            expect(myPipe(1, 2)).toBe(3);
            expect(myPipe(1, 2, 3)).toBe(6);
        });

        it("should convert class P { transform() } to a P-instance bound filter method", function() {
            const transformSpy = jasmine.createSpy("transform");

            @PipeFacade({name: "argsTest"})
            class P implements PipeTransformFacade {
                transform() {
                    transformSpy.apply(this, arguments);
                }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const myPipe = bootstrapAndInitialize("test", "argsTestFilter");

            myPipe(1, 2, 3);

            expect(transformSpy.calls.mostRecent().object).toEqual(jasmine.any(P));
            expect(transformSpy).toHaveBeenCalledWith(1, 2, 3);
        });

        it("should default @PipeFacade() to non-$stateful", function() {
            @PipeFacade({name: "noPure"})
            class P implements PipeTransformFacade {
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const noPure = bootstrapAndInitialize("test", "noPureFilter");
            expect(noPure.$stateful).toBe(false);
        });

        it("should convert @PipeFacade({pure: true}) to non-$stateful", function() {
            @PipeFacade({name: "pureTrue", pure: true})
            class P implements PipeTransformFacade {
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const pureTrue = bootstrapAndInitialize("test", "pureTrueFilter");
            expect(pureTrue.$stateful).toBe(false);
        });

        it("should convert @PipeFacade({pure: false}) to $stateful", function() {
            @PipeFacade({name: "pureFalse", pure: false})
            class P implements PipeTransformFacade {
                transform(x) { return x; }
            }

            @NgModuleFacade({id: "test", providers: [P]})
            class Mod {}

            const pureFalse = bootstrapAndInitialize("test", "pureFalseFilter");
            expect(pureFalse.$stateful).toBe(true);
        });
    });

    describe("@InjectableFacade", function() {
        it("should go on classes even though it doesn't do anything", function() {
            @InjectableFacade()
            class Foo {}

            expect(Foo).toBeDefined();
        });

        it("should be required when providing a service to NgModuleFacade", function() {
            class Foo {}
            @NgModuleFacade({id: "test", providers: [Foo]})
            class Mod {}
            expect(function() { bootstrapAndInitialize("test", Foo); }).toThrow();
        });

        it("should inject via TypeScript types", function m() {
            @InjectableFacade()
            class Foo {}

            @InjectableFacade()
            class Bar {
                constructor(public f: Foo) {}
            }

            @NgModuleFacade({id: "test", providers: [Foo, Bar]})
            class Mod {}

            const bar: Bar = bootstrapAndInitialize("test", Bar);

            expect(bar.f).toEqual(jasmine.any(Foo));
        });

        it("should inject other services via @InjectFacade('thing')", function() {
            @InjectableFacade()
            class Foo {
                constructor(@InjectFacade("$rootScope") public theScope) {}
            }

            @NgModuleFacade({id: "test", providers: [Foo]})
            class Mod {}

            const bar: Foo = bootstrapAndInitialize("test", Foo);

            expect(bar.theScope).not.toBeUndefined();
            expect(bar.theScope.$apply).toEqual(jasmine.any(Function));
        });

        it("should inject via TypeScript types on private/public fields and params", function() {
            @InjectableFacade()
            class Foo {}

            @InjectableFacade()
            class Bar {
                constructor(public f: Foo) {}
            }

            @InjectableFacade()
            class Baz {
                constructor(public b: Bar, f: Foo) {
                    expect(f).toBe(this.b.f);
                }
            }

            @NgModuleFacade({id: "test", providers: [Foo, Bar, Baz]})
            class Mod {}

            const baz = bootstrapAndInitialize("test", Baz);

            expect(baz.b).toEqual(jasmine.any(Bar));
        });

        it("should inject mix of @InjectFacade('thing') and via TypeScript types", function() {
            @InjectableFacade()
            class Foo {}

            @InjectableFacade()
            class Bar {
                constructor(public f: Foo, @InjectFacade("$rootScope") public s) {}
            }

            @NgModuleFacade({id: "test", providers: [Foo, Bar]})
            class Mod {}

            const bar = bootstrapAndInitialize("test", Bar);

            expect(bar.f).toEqual(jasmine.any(Foo));
            expect(bar.s.$apply).toEqual(jasmine.any(Function));
        });

        it("should inherited parent class constructors", function() {
            @InjectableFacade()
            class Baz {}

            @InjectableFacade()
            class Bar {
                constructor(public b: Baz, @InjectFacade("$rootScope") public s) {}
            }

            @InjectableFacade()
            class Foo extends Bar {}

            @NgModuleFacade({id: "test", providers: [Foo, Bar, Baz]})
            class Mod {}

            const foo = bootstrapAndInitialize("test", Foo);

            expect(foo.b).toEqual(jasmine.any(Baz));
            expect(foo.s.$apply).toEqual(jasmine.any(Function));
        });

        it("should override parent constructor metadata", function() {
            class Baz {}

            @InjectableFacade()
            class Bar {
                constructor(public b: Baz, public n: number) {}
            }

            @InjectableFacade()
            class Foo extends Bar {
                constructor() {
                    super(new Baz(), 42);
                }
            }

            @NgModuleFacade({id: "test", providers: [Foo, Bar]})
            class Mod {}

            const foo = bootstrapAndInitialize("test", Foo);

            expect(foo.b).toEqual(jasmine.any(Baz));
            expect(foo.n).toBe(42);
        });
    });

    describe("@InjectFacade", function() {
        it("should fill the $inject array based on constructor @InjectFacade arguments", function() {
            class Foo {
                constructor(@InjectFacade("foo") private myFoo, other, @InjectFacade("bar") public myBar) {}
            }

            expect(Foo.$inject).toEqual(<string[]>["foo", undefined, "bar"]);
        });
    });

    describe("$injector", function() {
        describe("get/has", function() {
            it("should convert types to name when invoking has/get", function() {
                @InjectableFacade()
                class Service {
                }

                class NotService {}

                @NgModuleFacade({id: "test", providers: [Service]})
                class Mod {}

                const $injector: angular.auto.IInjectorService = bootstrapAndInitialize("test", "$injector");

                expect($injector.has(NotService)).toBe(false);
                expect($injector.has(Service)).toBe(true);
                expect($injector.get(Service)).toEqual(jasmine.any(Service));
                expect(function() { $injector.get(NotService); }).toThrow();
            });
        });

        describe("instantiate", function() {
            it("should support passing types", function() {
                @InjectableFacade()
                class Service {
                }

                @NgModuleFacade({id: "test", providers: [Service]})
                class Mod {}

                const $injector: angular.auto.IInjectorService = bootstrapAndInitialize("test", "$injector");

                const instance1 = $injector.instantiate(Service);
                const instance2 = $injector.instantiate(Service);

                expect(instance1).toEqual(jasmine.any(Service));
                expect(instance2).toEqual(jasmine.any(Service));
                expect(instance1).not.toBe(instance2);
            });
        });

        describe("invoke", function() {
            it("should support passing types in the [..., func] $inject array", function() {
                @InjectableFacade()
                class Service {
                }

                @NgModuleFacade({id: "test", providers: [Service]})
                class Mod {}

                const $injector: angular.auto.IInjectorService = bootstrapAndInitialize("test", "$injector");

                let instance;
                $injector.invoke(["$rootScope", Service, function($rootScope, serv) {
                    instance = serv;
                }]);

                expect(instance).toEqual(jasmine.any(Service));
            });

            it("should support passing types in the func.$inject array", function() {
                @InjectableFacade()
                class Service {
                }

                @NgModuleFacade({id: "test", providers: [Service]})
                class Mod {}

                const $injector: angular.auto.IInjectorService = bootstrapAndInitialize("test", "$injector");

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

    describe("$provide", function() {
        function Obj() { /*empty*/ }

        describe("constant", function() {
            it("should allow types as names on IModule", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.constant(O, 42);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should allow types as names on $provide", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.constant(O, 42);
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should support {key: value} Objects", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.constant({foo: 42});

                const fetched = bootstrapAndInitialize(mod, "foo");

                expect(fetched).toBe(42);
            });
        });

        describe("value", function() {
            it("should allow types as names on IModule", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.value(O, 42);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should allow types as names on $provide", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.value(O, 42);
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should support {key: value} Objects", function() {
                const mod = angular.module("test", []);
                mod.value({foo: 42});

                const fetched = bootstrapAndInitialize(mod, "foo");

                expect(fetched).toBe(42);
            });
        });

        describe("service", function() {
            it("should allow types as names on IModule", function() {
                class TheType {}
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.service(O, TheType);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toEqual(jasmine.any(TheType));
            });

            it("should allow types as names on $provide", function() {
                class TheType {}
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.service(O, TheType);
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toEqual(jasmine.any(TheType));
            });

            it("should support {key: value} Objects", function() {
                class TheType {}
                const mod = angular.module("test", []);
                mod.service({foo: TheType});

                const fetched = bootstrapAndInitialize(mod, "foo");

                expect(fetched).toEqual(jasmine.any(TheType));
            });
        });

        describe("factory", function() {
            it("should allow types as names on IModule", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.factory(O, function() { return 42; });

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should allow types as names on $provide", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.factory(O, function() { return 42; });
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should support {key: value} Objects", function() {
                const mod = angular.module("test", []);
                mod.factory({foo() { return 42; }});

                const fetched = bootstrapAndInitialize(mod, "foo");

                expect(fetched).toBe(42);
            });
        });

        describe("decorator", function() {
            it("should allow decorating by type on IModule", function() {
                let del: TheType | undefined;

                class TheType {}
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.service(O, TheType);
                mod.decorator(O, ["$delegate", function($delegate) {
                    del = $delegate;
                    return 42;
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
                expect(del).toEqual(jasmine.any(TheType));
            });

            it("should allow decorating by type on $provide", function() {
                let del: TheType | undefined;

                class TheType {}
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.service(O, TheType);

                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.decorator(O, ["$delegate", function($delegate) {
                        del = $delegate;
                        return 42;
                    }]);
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });
        });

        describe("provider", function() {
            it("should allow providing by type on IModule", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.provider(O, {$get() { return 42; }});

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should allow providing by type on $provide", function() {
                const O = new Obj();
                const mod = angular.module("test", []);
                mod.config(["$provide", function(p: angular.auto.IProvideService) {
                    p.provider(O, {$get() { return 42; }});
                }]);

                const fetched = bootstrapAndInitialize(mod, O);

                expect(fetched).toBe(42);
            });

            it("should support {key: value} Objects", function() {
                const mod = angular.module("test", []);
                mod.provider({foo: {$get() { return 42; }}});

                const fetched = bootstrapAndInitialize(mod, "foo");

                expect(fetched).toBe(42);
            });
        });
    });

    describe("angular-mocks", function() {
        describe("it(() => module(); ...)", function() {
            it("should allow injecting @InjectableFacade via inject([]) wrapper", function() {
                @InjectableFacade()
                class Foo {}

                angular.mock.module(function($provide: angular.auto.IProvideService) {
                    $provide.service(Foo, Foo);
                });

                inject([Foo, function(foo: Foo) {
                    expect(foo).toEqual(jasmine.any(Foo));
                }]);
            });

            it("should allow injecting non-@InjectableFacade provider key via inject([]) wrapper", function() {
                class Foo {}

                angular.mock.module(function($provide: angular.auto.IProvideService) {
                    $provide.constant(Foo, 42);
                });

                inject([Foo, function(foo: number) {
                    expect(foo).toBe(42);
                }]);
            });
        });

        describe("beforeEach(module())", function() {
            @InjectableFacade()
            class FooInjectableFacade {}

            class Foo {}

            @NgModuleFacade({
                id: "inject-testing",

                providers: [
                    FooInjectableFacade,
                    {provide: Foo, useClass: Foo}
                ]
            })
            class FooModule {}

            beforeEach(angular.mock.module("inject-testing"));

            it("should allow injecting @InjectableFacade via inject([Type, test])", inject([FooInjectableFacade, function(foo: FooInjectableFacade) {
                expect(foo).toEqual(jasmine.any(FooInjectableFacade));
            }]));

            it("should allow injecting non-@InjectableFacade via inject([Type, test])", inject([Foo, function(foo: Foo) {
                expect(foo).toEqual(jasmine.any(Foo));
            }]));
        });

        describe("beforeEach(module(X), ($provider for X))", function() {
            class Foo {}

            // The module containing the downgradeProvder() style thing
            // ... which depends on a test-time provided-thing (like the ng2 injector)
            angular.module("inject-testing2", [])
                .factory(Foo, ["provided-thing", function(thing) {
                    return thing;
                }])
            ;

            //The test-time provided thing in a beforeEach()
            beforeEach(angular.mock.module("inject-testing2", function($provide: angular.auto.IProvideService) {
                $provide.factory("provided-thing", () => new Foo());
            }));

            it("should allow injecting @InjectableFacade via inject([Type, test])", inject([Foo, function(foo: Foo) {
                expect(foo).toEqual(jasmine.any(Foo));
            }]));

            it("should allow injecting non-@InjectableFacade via inject([Type, test])", inject([Foo, function(foo: Foo) {
                expect(foo).toEqual(jasmine.any(Foo));
            }]));
        });
    });

    describe("IModule", function() {
        function createModule(provider: ProviderFacade): angular.IModule {
            @NgModuleFacade({
                id: "test", providers: [provider]
            })
            class Mod {}

            return angular.module("test");
        }


        it("should support injecting types into run", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.run([Foo, function(f: Foo) { injected = f; }]);

            bootstrap(module);
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into run", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.run([injectorKey, function(f) { injected = f; }]);

            bootstrap(module);
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into directive factories", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.directive("injectFoo", [Foo, function(f: Foo): angular.IDirective {
                injected = f;
                return {};
            }]);

            module.run(["$compile", "$rootScope", function($compile: angular.ICompileService, $rootScope: angular.IRootScopeService) {
                $compile("<inject-foo>")($rootScope).remove();
            }]);

            bootstrap(module);
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into directive factories", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.directive("injectFoo", [injectorKey, function(f): angular.IDirective {
                injected = f;
                return {};
            }]);

            module.run(["$compile", "$rootScope", function($compile: angular.ICompileService, $rootScope: angular.IRootScopeService) {
                $compile("<inject-foo>")($rootScope).remove();
            }]);

            bootstrap(module);
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into component controllers", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.component("injectFoo", {controller: [Foo, function(f: Foo) { injected = f; return {}; }]});

            module.run(["$compile", "$rootScope", function($compile: angular.ICompileService, $rootScope: angular.IRootScopeService) {
                $compile("<inject-foo>")($rootScope).remove();
            }]);

            bootstrap(module);
            expect(injected).toEqual(jasmine.any(Foo));
        });

        //TODO:
        // it("should support injecting any key type into component controllers", function() {
        //     const injectorKey = {};

        //     @InjectableFacade()
        //     class Foo {}

        //     const module = createModule({provide: injectorKey, useValue: Foo});
        //     let injected;

        //     module.component("injectFoo", {controller: [injectorKey, function(f: Foo) { injected = f; return {}; }]});

        //     module.run(["$compile", "$rootScope", function($compile: angular.ICompileService, $rootScope: angular.IRootScopeService) {
        //         $compile("<inject-foo>")($rootScope).remove();
        //     }]);

        //     bootstrap(module);
        //     expect(injected).toEqual(jasmine.any(Foo));
        // });

        it("should support injecting types into controllers", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.controller("injectFoo", [Foo, function(f: Foo) { injected = f; }]);

            const $controller: angular.IControllerService = bootstrapAndInitialize(module, "$controller");
            $controller("injectFoo");
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into controllers", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.controller("injectFoo", [injectorKey, function(f) { injected = f; }]);

            const $controller: angular.IControllerService = bootstrapAndInitialize(module, "$controller");
            $controller("injectFoo");
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into factories", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.factory("injectFoo", [Foo, function(f: Foo) { return (injected = f); }]);

            bootstrapAndInitialize(module, "injectFoo");
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into factories", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.factory("injectFoo", [injectorKey, function(f) { return (injected = f); }]);

            bootstrapAndInitialize(module, "injectFoo");
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into services", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.service("injectFoo", [Foo, function(f: Foo) { return (injected = f); }]);

            bootstrapAndInitialize(module, "injectFoo");
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into services", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.service("injectFoo", [injectorKey, function(f) { return (injected = f); }]);

            bootstrapAndInitialize(module, "injectFoo");
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into filters", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.filter("injectFoo", [Foo, function(f: Foo) { return (injected = f); }]);

            bootstrapAndInitialize(module, "$filter")("injectFoo");
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into filters", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.filter("injectFoo", [injectorKey, function(f) { return (injected = f); }]);

            bootstrapAndInitialize(module, "$filter")("injectFoo");
            expect(injected).toBe(injectorValue);
        });

        it("should support injecting types into decorators", function() {
            @InjectableFacade()
            class Foo {}

            const module = createModule(Foo);
            let injected;

            module.decorator("$parse", [Foo, "$delegate", function(f: Foo, d) {
                injected = f;
                return d;
            }]);

            bootstrapAndInitialize(module, "$parse");
            expect(injected).toEqual(jasmine.any(Foo));
        });

        it("should support injecting any key type into decorators", function() {
            const injectorKey = {};
            const injectorValue = [];

            const module = createModule({provide: injectorKey, useValue: injectorValue});
            let injected;

            module.decorator("$parse", [injectorKey, "$delegate", function(f, d) {
                injected = f;
                return d;
            }]);

            bootstrapAndInitialize(module, "$parse");
            expect(injected).toBe(injectorValue);
        });
    });

    describe("lifecycle interfaces", function() {
        it("should provide OnInitFacade", function() {
            class I implements OnInitFacade {
                $onInit(): void {
                    //noop
                }
            }
        });

        it("should provide OnChangesFacade", function() {
            class I implements OnChangesFacade {
                $onChanges(onChangesObj: angular.IOnChangesObject): void {
                    //noop
                }
            }
        });

        it("should provide OnDestroyFacade", function() {
            class I implements OnDestroyFacade {
                $onDestroy(): void {
                    //noop
                }
            }
        });

        it("should provide DoCheckFacade", function() {
            class I implements DoCheckFacade {
                $doCheck(): void {
                    //noop
                }
            }
        });
    });

    describe("@ComponentFacade", function() {
        it("should delegate @ComponentFacade() in @NgModuleFacade{declarations} to module.directive", function() {
            const spies = createMockModule();

            @ComponentFacade({
                selector: "comp-selector"
            })
            class Comp {}

            @NgModuleFacade({id: "compMod", declarations: [Comp]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({controller: Comp}));
        });

        it("should provide module.component like defaults for @ComponentFacade() to module.directive", function() {
            const spies = createMockModule();

            @ComponentFacade({
                selector: "comp-selector"
            })
            class Comp {}

            @NgModuleFacade({id: "compMod", declarations: [Comp]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({
                controller: Comp,
                controllerAs: "$ctrl",
                scope: {},
                bindToController: {},
                restrict: "E"
            }));
        });

        it("should convert dash-cased name to module.directive camelCased", function() {
            const spies = createMockModule();

            @ComponentFacade({
                selector: "comp-selector"
            })
            class Comp {}

            @NgModuleFacade({id: "compMod", declarations: [Comp]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({
                require: {
                    $$self: "compSelector"
                }
            }));
        });

        describe("@InputFacade", function() {
            it("should convert @InputFacade() fields to module.directive <? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @InputFacade()
                    public inputName;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({bindToController: {inputName: "<?"}, controller: Comp}));
            });

            it("should convert @InputFacade('altName') fields to module.directive aliased <? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @InputFacade("altName")
                    public inputName;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({bindToController: {inputName: "<?altName"}, controller: Comp}));
            });

            it("should convert @InputFacade('dash-cased') fields to module.directive aliased <? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @InputFacade("dash-cased")
                    public inputName;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    bindToController: {inputName: "<?dashCased"},
                    controller: Comp
                }));
            });

            it("should convert @InputStringFacade() fields to module.directive @? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @InputStringFacade()
                    public inputName;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({bindToController: {inputName: "@?"}, controller: Comp}));
            });

            it("should convert @InputCallbackFacade() fields to module.directive &? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @InputCallbackFacade()
                    public inputName;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({bindToController: {inputName: "&?"}, controller: Comp}));
            });
        });

        describe("@OutputFacade", function() {
            it("should convert @OutputFacade() fields to module.directive &? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    bindToController: {[OUTPUT_BOUND_CALLBACK_PREFIX + "outputName"]: "&?outputName"},
                    controller: Comp
                }));
            });

            it("should convert @OutputFacade('dash-cased') fields to module.directive aliased &? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade("dash-cased")
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    bindToController: {[OUTPUT_BOUND_CALLBACK_PREFIX + "outputName"]: "&?dashCased"},
                    controller: Comp
                }));
            });

            it("should convert @OutputFacade('altName') fields to module.directive aliased &? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade("altName")
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    bindToController: {[OUTPUT_BOUND_CALLBACK_PREFIX + "outputName"]: "&?altName"},
                    controller: Comp
                }));
            });

            it("should convert multiple @OutputFacade() fields to multiple module.directive &? bindToController", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();
                    @OutputFacade("nameTwo")
                    public outputName2: EventEmitterFacade<any>;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    bindToController: {
                        [OUTPUT_BOUND_CALLBACK_PREFIX + "outputName"]: "&?outputName",
                        [OUTPUT_BOUND_CALLBACK_PREFIX + "outputName2"]: "&?nameTwo"
                    },
                    controller: Comp
                }));
            });

            it("should invoke binding expressions when @OutputFacade() EventEmitterFacade.emit invoked", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();

                    constructor() {
                        instance = this;
                    }

                    fire() {
                        this.outputName.emit();
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const foo = jasmine.createSpy("callback");

                bootstrapAndCompile("compMod", "<comp output-name='foo()'>", {foo});

                expect(instance).toEqual(jasmine.any(Comp));

                instance!.fire();
                expect(foo).toHaveBeenCalled();
            });

            it("should invoke binding expressions when @OutputFacade('dash-cased') is used", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade("dash-cased")
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();

                    constructor() {
                        instance = this;
                    }

                    fire() {
                        this.outputName.emit();
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const foo = jasmine.createSpy("callback");

                bootstrapAndCompile("compMod", "<comp dash-cased='foo()'>", {foo});

                expect(instance).toEqual(jasmine.any(Comp));

                instance!.fire();
                expect(foo).toHaveBeenCalled();
            });

            it("should invoke binding expressions when @OutputFacade('camelCased') is used", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade("camelCased")
                    public outputName: EventEmitterFacade<any> = new EventEmitterFacade();

                    constructor() {
                        instance = this;
                    }

                    fire() {
                        this.outputName.emit();
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const foo = jasmine.createSpy("callback");

                bootstrapAndCompile("compMod", "<comp camel-cased='foo()'>", {foo});

                expect(instance).toEqual(jasmine.any(Comp));

                instance!.fire();
                expect(foo).toHaveBeenCalled();
            });

            it("should invoke binding local $event variable when invoking @OutputFacade() EventEmitters", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<number> = new EventEmitterFacade();

                    constructor() {
                        instance = this;
                    }

                    fire(n) {
                        this.outputName.emit(n);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const foo = jasmine.createSpy("callback");

                bootstrapAndCompile("compMod", "<comp output-name='foo($event)'>", {foo});

                expect(instance).toEqual(jasmine.any(Comp));

                instance!.fire(1);
                expect(foo).toHaveBeenCalledWith(1);
            });

            it("should throw when emiting @OutputFacade() within $onInit", function() {
                let caughtException;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<number> = new EventEmitterFacade();

                    $onInit() {
                        try {
                            this.outputName.emit(1);
                        }
                        catch (e) {
                            caughtException = e;
                        }
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                bootstrapAndCompile("compMod", "<comp output-name='foo($event)'>");

                expect(caughtException).toEqual(new Error("Uninitialized EventEmitterFacade"));
            });

            it("should throw when emiting @OutputFacade() before $onInit", function() {
                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<number> = new EventEmitterFacade();

                    constructor() {
                        this.outputName.emit(1);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expect(function() { return new EventEmitterFacade().emit(); }).toThrowError("Uninitialized EventEmitterFacade");

                expect(function() { return new Comp(); }).toThrowError("Uninitialized EventEmitterFacade");

                expect(function() {
                    bootstrapAndCompile("compMod", "<comp>");
                })
                .toThrowError("Uninitialized EventEmitterFacade");
            });

            it("should support emiting @OutputFacade() emitters with no bound callback", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @OutputFacade()
                    public outputName: EventEmitterFacade<number> = new EventEmitterFacade();

                    constructor() {
                        instance = this;
                    }

                    fire(n) {
                        this.outputName.emit(n);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const foo = jasmine.createSpy("callback");

                bootstrapAndCompile("compMod", "<comp>", {foo});

                expect(instance).toEqual(jasmine.any(Comp));

                instance!.fire(1);
                instance!.fire(2);
            });

            it("should throw if @OutputFacade() does not have EventEmitterFacade as type", function() {
                expect(function() {
                    @ComponentFacade({
                        selector: "comp"
                    })
                    class Comp {
                        @OutputFacade()
                        public outputName;
                    }
                })
                .toThrowError("Comp.outputName type must be EventEmitterFacade");
            });

            it("should allow extensions of EventEmitterFacade as @OutputFacade() type", function() {
                class ExtendedEmitter extends EventEmitterFacade<number> {}

                expect(function() {
                    @ComponentFacade({
                        selector: "comp"
                    })
                    class Comp {
                        @OutputFacade()
                        public outputName: ExtendedEmitter;
                    }
                })
                .not.toThrow();
            });
        });

        describe("@RequireFacade", function() {
            it("should convert @RequireFacade() fields to module.directive require with same name as field", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade()
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "requirement"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade('^') fields to module.directive require with same name as field", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("^")
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "^requirement"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade('name') fields to module.directive require", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("name")
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "name"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade('^^name') fields to module.directive require", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("^^name")
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "^^name"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade('dash-cased') fields to camelCased module.directive require", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("dash-cased")
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "dashCased"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade('^dash-cased') fields to camelCased module.directive require", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("^dash-cased")
                    public requirement;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({requirement: "^dashCased"}),
                    controller: Comp
                }));
            });

            it("should convert @RequireFacade()camelCased fields to camelCased mmodule.directive require", function() {
                const spies = createMockModule();

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade()
                    public camelCased;
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                expectDirectiveDefinitionCall(spies, "comp", jasmine.objectContaining({
                    require: jasmine.objectContaining({camelCased: "camelCased"}),
                    controller: Comp
                }));
            });

            it("should setup @RequireFacade() on compilation", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade()
                    public ngModel;

                    constructor() { instance = this; }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                bootstrapAndCompile("compMod", "<comp ng-model='bar'>");

                expect(instance).toEqual(jasmine.any(Comp));
                expect(instance!.ngModel).toBeDefined();
            });

            it("should setup @RequireFacade('camelCased') on compilation", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("ngModel")
                    public foo;

                    constructor() { instance = this; }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                bootstrapAndCompile("compMod", "<comp ng-model='bar'>");

                expect(instance).toEqual(jasmine.any(Comp));
                expect(instance!.foo).toBeDefined();
            });

            it("should setup @RequireFacade('dash-cased') on compilation", function() {
                let instance: Comp | undefined;

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @RequireFacade("ng-model")
                    public foo;

                    constructor() { instance = this; }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                bootstrapAndCompile("compMod", "<comp ng-model='bar'>");

                expect(instance).toEqual(jasmine.any(Comp));
                expect(instance!.foo).toBeDefined();
            });
        });

        describe("@HostListenerFacade", function() {
            it("should bind @HostListenerFacade('asdf') to the DOM 'asdf' event", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf")
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalled();
            });

            it("should bind multiple @HostListenerFacade('asdf')s to the DOM 'asdf' event", function() {
                const foo = jasmine.createSpy("foo event callback");
                const bar = jasmine.createSpy("bar event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf")
                    foo() {
                        foo.apply(this, arguments);
                    }
                    @HostListenerFacade("asdf")
                    bar() {
                        bar.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                expect(bar).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalled();
                expect(bar).toHaveBeenCalled();
            });

            it("should invoke the expression within a digest", function() {
                const foo = jasmine.createSpy("foo event callback");

                let phase;
                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    constructor(@InjectFacade("$rootScope") public $rootScope) {}

                    @HostListenerFacade("asdf")
                    adsf() {
                        phase = this.$rootScope.$$phase;
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(phase).toBeUndefined();
                $dom.triggerHandler("asdf");
                expect(phase).toBe("$apply");
            });

            it("should support DOM events triggered while already in a digest", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    constructor(@InjectFacade("$element") private $element) {}
                    @HostListenerFacade("asdf")
                    adsf() {
                        foo.apply(this, arguments);
                    }

                    @HostListenerFacade("first")
                    first() {
                        this.$element.triggerHandler("asdf");
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("first");
                expect(foo).toHaveBeenCalled();
            });

            it("should pass arguments specified in @HostListenerFacade('asdf', [...args])", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf", ["1", "2", "null"])
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalledWith(1, 2, null);
            });

            it("should support the $event argument in @HostListenerFacade('asdf', ['$event'])", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf", ["$event"])
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalledWith(jasmine.objectContaining({type: "asdf", target: $dom[0]}));
            });

            it("should support expressions in @HostListenerFacade args)", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf", ["$event.target", "1+2"])
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalledWith($dom[0], 3);
            });

            it("should not provide access to values on the $scope", function() {
                const foo = jasmine.createSpy("foo event callback");

                @ComponentFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf", ["$root", "$id", "$ctrl"])
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalledWith(undefined, undefined, undefined);
            });
        });
    });

    describe("@DirectiveFacade", function() {
        function getMockedDirective(spies) {
            expect(spies.directive).toHaveBeenCalled();

            const [name, factory] = spies.directive.calls.mostRecent().args;

            return {
                name,
                factory: factory[factory.length - 1]
            };
        }

        it("should delegate @DirectiveFacade() in @NgModuleFacade{declarations} to module.directive", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: "dir-selector"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("dirSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "E", controller: Dir}));
        });

        it("should support attribute selectors", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: "[dir-selector]"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("dirSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "A", controller: Dir}));
        });

        it("should support class selectors", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: ".cls-selector"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            const {name, factory} = getMockedDirective(spies);

            expect(name).toBe("clsSelector");
            expect(factory()).toEqual(jasmine.objectContaining({restrict: "C", controller: Dir}));
        });

        it("should convert dash-cased element name to module.directive camelCased", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: "comp-selector"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({
                restrict: "E",
                require: {
                    $$self: "compSelector"
                }
            }));
        });

        it("should convert .dash-cased class name to module.directive camelCased", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: ".comp-selector"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({
                restrict: "C",
                require: {
                    $$self: "compSelector"
                }
            }));
        });

        it("should convert [dash-cased] attribute name to module.directive camelCased", function() {
            const spies = createMockModule();

            @DirectiveFacade({
                selector: "[comp-selector]"
            })
            class Dir {}

            @NgModuleFacade({id: "compMod", declarations: [Dir]})
            class Mod {}

            expectDirectiveDefinitionCall(spies, "compSelector", jasmine.objectContaining({
                restrict: "A",
                require: {
                    $$self: "compSelector"
                }
            }));
        });

        describe("unsupported", function() {
            it("should throw when using @InputFacade", function() {
                @DirectiveFacade({
                    selector: "dir"
                })
                class Dir {
                    @InputFacade() public foo;
                }

                expect(function() {
                    @NgModuleFacade({id: "compMod", declarations: [Dir]})
                    class Mod {}
                })
                .toThrowError("DirectiveFacade input unsupported");
            });

            it("should throw when using @OutputFacade", function() {
                @DirectiveFacade({
                    selector: "dir"
                })
                class Dir {
                    @OutputFacade() public foo: EventEmitterFacade<any>;
                }

                expect(function() {
                    @NgModuleFacade({id: "compMod", declarations: [Dir]})
                    class Mod {}
                })
                .toThrowError("DirectiveFacade input unsupported");
            });

            it("should throw when using @RequireFacade", function() {
                @DirectiveFacade({
                    selector: "dir"
                })
                class Dir {
                    @RequireFacade() public foo;
                }

                expect(function() {
                    @NgModuleFacade({id: "compMod", declarations: [Dir]})
                    class Mod {}
                })
                .toThrowError("DirectiveFacade require unsupported");
            });
        });

        describe("@HostListenerFacade", function() {
            it("should bind @HostListenerFacade('asdf') to the DOM 'asdf' event", function() {
                const foo = jasmine.createSpy("foo event callback");

                @DirectiveFacade({
                    selector: "comp"
                })
                class Comp {
                    @HostListenerFacade("asdf")
                    adsf() {
                        foo.apply(this, arguments);
                    }
                }

                @NgModuleFacade({id: "compMod", declarations: [Comp]})
                class Mod {}

                const {$dom} = bootstrapAndCompile("compMod", "<comp>");

                expect(foo).not.toHaveBeenCalled();
                $dom.triggerHandler("asdf");
                expect(foo).toHaveBeenCalled();
            });
        });
    });

    it("should not use raw function names as angular service names", function() {
        spyOn(<any>window, "angular");
        delete window["angular"].mock;

        @InjectableFacade()
        class Service {
        }

        @NgModuleFacade({id: "test", providers: [Service]})
        class Mod {}

        const $injector = bootstrapAndInitialize("test", "$injector");

        expect($injector.has("Service")).toBe(false);
        expect($injector.has(Service)).toBe(true);
    });

    it("should use raw function names when running alongside angular-mock", function() {
        @InjectableFacade()
        class Service {
        }

        @NgModuleFacade({id: "test", providers: [Service]})
        class Mod {}

        const $injector = bootstrapAndInitialize("test", "$injector");

        expect($injector.has("Service")).toBe(true, "has(string)");
        expect($injector.has(Service)).toBe(true, "has(class)");
        expect($injector.get("Service")).toBe($injector.get(Service));
    });
});