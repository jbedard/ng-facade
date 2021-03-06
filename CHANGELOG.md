<a name="0.5.0"></a>
# [0.5.0](https://github.com/jbedard/ng-facade/compare/v0.4.4...v0.5.0) (2018-08-19)


### Features

* add a `Facade` suffix to all exported names ([86bd851](https://github.com/jbedard/ng-facade/commit/86bd851))
* support angular 1.7 ([e67d7b8](https://github.com/jbedard/ng-facade/commit/e67d7b8))



<a name="0.4.4"></a>
## [0.4.4](https://github.com/jbedard/ng-facade/compare/v0.4.3...v0.4.4) (2018-08-19)


### Bug Fixes

* allow factory/service/constant/value to pass objects ([1d93647](https://github.com/jbedard/ng-facade/commit/1d93647)), closes [#23](https://github.com/jbedard/ng-facade/issues/23)



<a name="0.4.3"></a>
## [0.4.3](https://github.com/jbedard/ng-facade/compare/v0.4.1...v0.4.3) (2017-08-18)


### Bug Fixes

* declare angular dependency as a peer dependency ([99d1924](https://github.com/jbedard/ng-facade/commit/99d1924))
* **useFactory:** allow use of $inject on factory methods ([568ba58](https://github.com/jbedard/ng-facade/commit/568ba58)), closes [#25](https://github.com/jbedard/ng-facade/issues/25)



<a name="0.4.0"></a>
# [0.4.0](https://github.com/jbedard/ng-facade/compare/v0.3.3...v0.4.0) (2017-03-27)


### Features

* support types as factory/service/constant/decorator/... names ([7f1b14e](https://github.com/jbedard/ng-facade/commit/7f1b14e)), closes [#19](https://github.com/jbedard/ng-facade/issues/19)
* **Component:** add Angular lifecycle interfaces with AngularJS methods ([de4d2f2](https://github.com/jbedard/ng-facade/commit/de4d2f2)), closes [#20](https://github.com/jbedard/ng-facade/issues/20)
* enable TypeScript strictNullChecks ([a53a637](https://github.com/jbedard/ng-facade/commit/a53a637))
* remove the direct dependency on reflect-metadata, allow use of es7.reflect shim  ([8fa4d93](https://github.com/jbedard/ng-facade/commit/8fa4d93)), closes [#22](https://github.com/jbedard/ng-facade/issues/22)


### BREAKING CHANGES

* reflect-metadata, es7.reflect or a similar shim must now be included manually


<a name="0.3.3"></a>
## [0.3.3](https://github.com/jbedard/ng-facade/compare/v0.3.2...v0.3.3) (2017-03-22)



### Bug Fixes

* **Injectable,$inject:** augment @types/angular to support injecting non-string into decorators ([54f9a11](https://github.com/jbedard/ng-facade/commit/54f9a11)), closes [#2](https://github.com/jbedard/ng-facade/issues/2)
* **Pipe:** make pipes injectable ([2458d34](https://github.com/jbedard/ng-facade/commit/2458d34)), closes [#18](https://github.com/jbedard/ng-facade/issues/18)



<a name="0.3.2"></a>
## [0.3.2](https://github.com/jbedard/ng-facade/compare/v0.3.1...v0.3.2) (2017-03-22)


### Bug Fixes

* **Injectable,$inject:** augment @types/angular to support non-string types as injectable names ([c7c8690](https://github.com/jbedard/ng-facade/commit/c7c8690)), closes [#16](https://github.com/jbedard/ng-facade/issues/16)
* **NgModule:** fix ValueProvider ([9f6f3f7](https://github.com/jbedard/ng-facade/commit/9f6f3f7)), closes [#17](https://github.com/jbedard/ng-facade/issues/17)



<a name="0.3.1"></a>
## [0.3.1](https://github.com/jbedard/ng-facade/compare/v0.3.0...v0.3.1) (2017-03-02)



<a name="0.3.0"></a>
# [0.3.0](https://github.com/jbedard/ng-facade/compare/38abcb7...v0.3.0) (2017-03-02)


### Bug Fixes

* **Component,Directive:** support Require/Input/Output('dash-cased') ([38abcb7](https://github.com/jbedard/ng-facade/commit/38abcb7)), closes [#10](https://github.com/jbedard/ng-facade/issues/10)
* **Directive:** allow use of HostListener on Directives ([dd794d9](https://github.com/jbedard/ng-facade/commit/dd794d9)), closes [#9](https://github.com/jbedard/ng-facade/issues/9)
* **HostListener:** invoke listeners within a digest ([cc92972](https://github.com/jbedard/ng-facade/commit/cc92972)), closes [#11](https://github.com/jbedard/ng-facade/issues/11)
* **Injectable:** create new instances for each useClass ([5730baa](https://github.com/jbedard/ng-facade/commit/5730baa)), closes [#14](https://github.com/jbedard/ng-facade/issues/14)
* **Injectable:** remove need to tag provider keys as injectable ([5b57358](https://github.com/jbedard/ng-facade/commit/5b57358)), closes [#13](https://github.com/jbedard/ng-facade/issues/13)
* **NgModule:** add Provider interface for stricter type checking ([2fda260](https://github.com/jbedard/ng-facade/commit/2fda260))


### Features

* **Injector:** support factory deps ([fbed34e](https://github.com/jbedard/ng-facade/commit/fbed34e)), closes [#12](https://github.com/jbedard/ng-facade/issues/12)



<a name="0.2.0"></a>
# 0.2.0 (2017-02-19)


### Features

* **@Output:** add [@Output](https://github.com/Output)/EventEmitter support ([fe22d84](https://github.com/jbedard/ng-facade/commit/fe22d84)), closes [#4](https://github.com/jbedard/ng-facade/issues/4)
* **HostListener:** add component HostListener support ([84e554b](https://github.com/jbedard/ng-facade/commit/84e554b)), closes [#6](https://github.com/jbedard/ng-facade/issues/6)



<a name="0.1.2"></a>
## 0.1.2 (2017-02-19)

* **pipe**: Fix context of Pipe transform method ([47aeafb](https://github.com/jbedard/ng-facade/commit/47aeafb)), closes [#5](https://github.com/jbedard/ng-facade/issues/5)



<a name="0.1.1"></a>
## 0.1.1 (2017-02-03)

* **ng-facade**: initial ng-facade implementation ([e2383a6](https://github.com/jbedard/ng-facade/commit/e2383a6))