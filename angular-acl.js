/**
 * version 0.0.9
 * @author  
 * Based on https://github.com/mikemclin/angular-acl
 * and it's modification by Alex Gorovyi
 * Edited by Tahiaji
 *
 * tested with AngularJS v1.2.28 
 * tested with AngularJS v1.3.18 
 */
'use strict';
angular.module('acl', []);

angular.module('acl').provider('Acl', [
    function () {
        /** Polyfill for IE8 http://stackoverflow.com/a/1181586*/
        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function (needle) {
                var l = this.length;
                for (; l--; ) {
                    if (this[l] === needle) {
                        return l;
                    }
                }
                return -1;
            };
        }
        var config = {
            defaultRole: 'guest',
            defaultUser: {},
            storage: 'sessionStorage',
            storageKey: 'Acl',
            permissions: {},
            emptyActionDefault: false//defaut rights if no action
        }

        var data = {
            user: {},
            role: config.defaultRole
        }

        var Acl = {};
        Object.defineProperty(Acl, 'user', {
            enumerable: true,
            configurable: true,
            writable: false,
            value: {}
        });

        var getRoleRoles = function (role) {
            return config.permissions[role] && config.permissions[role].roles ? config.permissions[role].roles : null;
        }

        var getRoleActions = function (role) {
            return config.permissions[role] && config.permissions[role].actions ? config.permissions[role].actions : null;
        }

        var setUser = function (userData) {
            for (var key in Acl.user) {
                delete(Acl.user[key]);
            }
            angular.extend(Acl.user, config.defaultUser, userData, {role: data.role});
        }

        var restore = function () {
            var storedData;
            switch (config.storage) {
                case 'sessionStorage':
                    storedData = window['sessionStorage'].getItem(config.storageKey);
                    break;
                case 'localStorage':
                    storedData = window['localStorage'].getItem(config.storageKey);
                    break;
                default:
                    storedData = null;
            }
            if (storedData) {
                storedData = JSON.parse(storedData);
                data.role = storedData.role;
                setUser(storedData.user);
                return true;
            }
            return false;
        }

        var save = function () {
            data.user = Acl.user;
            switch (config.storage) {
                case 'sessionStorage':
                    window['sessionStorage'].setItem(config.storageKey, JSON.stringify(data));
                    break;
                case 'localStorage':
                    window['localStorage'].setItem(config.storageKey, JSON.stringify(data));
                    break;
                default:
                    // Don't save
                    return;
            }
        }

        /*----------------------------------------------------------------------------*/

        Acl.login = function (role, userData) {
            data.role = role;
            setUser(userData);
            save();
        }

        Acl.logout = function () {
            data.role = config.defaultRole;
            setUser();
            save();
        }

        Acl.save = function (userData) {
            setUser(userData);
            save();
        }
        Acl.update = function () {
            save();
        }

        Acl.hasRole = function (role) {
            var hasRole = function (role, compare) {
                if (role == compare) {
                    return true;
                }
                var roles = getRoleRoles(compare);
                if (roles) {
                    for (var key = 0; key < roles.length; key++) {
                        if (hasRole(role, roles[key])) {
                            return true;
                        }
                    }
                }
                return false;
            }
            return hasRole(role, data.role);
        }


        /**
         * can user access to this action?
         * 
         * @returns {Boolean} (true - can, false - can't)
         */
        Acl.can = function (action, params) {
            /**
             * 
             * @param {type} action
             * @param {type} role
             * @returns 0 -access not defined; 1 - defined, and user have access; 2 - defined, and user don't have access
             */
            var can = function (action, role) {
                var actions, roles;
                actions = getRoleActions(role);
                if (actions) {
                    if (angular.isDefined(actions[action])) {
                        if (!actions[action]) {
                            return 2;
                        }
                        if (angular.isFunction(actions[action])) {
                            if (actions[action](Acl.user, params)) {
                                return 1;
                            }
                        }
                        return 1;
                    } else {//find .*
                        var res = 0;
                        angular.forEach(actions, function (value, key) {
                           if (key.indexOf('*') != -1) {                                
                                var re = new RegExp(key, 'gi');
                                if (re.test(action)) {
                                    res = value ? 1 : 2;//can't return from foreach
                                }
                            }
                        })
                        if(res){
                            return res;
                        }
                    }
                }
                if (roles = getRoleRoles(role)) {                   
                    for (var key = 0; key < roles.length; key++) {
                        if (can(action, roles[key])) {//if action exis - return it!
                            return can(action, roles[key]);
                        }
                    }
                }
                return 0;
            };

            var access = can(action, data.role);
            if (access == 1) {
                //console.log('defined-allow');
                return true
            } else if (access == 2) {
                //console.log('defined-deny');
                return false
            } else if (access == 0) {
                //console.log('not defined');
                return config.emptyActionDefault;
            }
        }

        Acl.isGuest = function () {
            return data.role == config.defaultRole;
        }

        /*----------------------------------------------------------------------------*/

        return {
            config: function (params) {
                angular.extend(config, params);
                data.role = config.defaultRole;
                setUser();
                restore();

            },
            $get: function () {
                return Acl;
            },
        }
        restore();
        /*----------------------------------------------------------------------------*/

    }
]).directive("allow", ['$animate', 'Acl', function ($animate, Acl) {
        return {
            restrict: 'EA',
            transclude: 'element',
            priority: 1000,
            terminal: true,
            $$tlb: true,
            scope: {
                allowParams: '='
            },
            compile: function (element, attr, transclude) {
                return function ($scope, $element, $attr) {
                    var childElement, childScope;
                    $scope.$parent.$watch(function () {
                        return Acl.can($attr.allow, $scope.allowParams);
                    }, function (allow) {
                        if (!angular.isDefined(allow))
                            return;
                        if (childElement) {
                            $animate.leave(childElement);
                            childElement = undefined;
                        }
                        if (childScope) {
                            childScope.$destroy();
                            childScope = undefined;
                        }
                        if (allow) {
                            childScope = $scope.$parent.$new();
                            transclude(childScope, function (clone) {
                                childElement = clone;
                                $animate.enter(clone, $element.parent(), $element);
                            });
                        }
                    });
                }
            }
        };
    }]).directive("allowrole", ['$animate', 'Acl', function ($animate, Acl) {
        return {
            transclude: 'element',
            priority: 1000,
            terminal: true,
            restrict: 'A',
            $$tlb: true,
            compile: function (element, attr, transclude) {
                return function ($scope, $element, $attr) {
                    var childElement, childScope;
                    $scope.$watch(function () {
                        return Acl.hasRole($attr.allowrole);
                    }, function (allow) {
                        if (!angular.isDefined(allow))
                            return;
                        if (childElement) {
                            $animate.leave(childElement);
                            childElement = undefined;
                        }
                        if (childScope) {
                            childScope.$destroy();
                            childScope = undefined;
                        }
                        if (allow) {
                            childScope = $scope.$new();
                            transclude(childScope, function (clone) {
                                childElement = clone;
                                $animate.enter(clone, $element.parent(), $element);
                            });
                        }
                    });
                }
            }
        };
    }]).directive("denyrole", ['$animate', 'Acl', function ($animate, Acl) {//if object must be hidden for specified role
        return {
            transclude: 'element',
            priority: 1000,
            terminal: true,
            restrict: 'A',
            $$tlb: true,
            compile: function (element, attr, transclude) {
                return function ($scope, $element, $attr) {
                    var childElement, childScope;
                    $scope.$watch(function () {
                        return Acl.hasRole($attr.denyrole);
                    }, function (deny) {                        
                        if (!angular.isDefined(deny))
                            return;
                        if (childElement) {
                            $animate.leave(childElement);
                            childElement = undefined;
                        }
                        if (childScope) {
                            childScope.$destroy();
                            childScope = undefined;
                        }
                        if (!deny) {//show element
                            childScope = $scope.$new();
                            transclude(childScope, function (clone) {
                                childElement = clone;
                                $animate.enter(clone, $element.parent(), $element);
                            });
                        }
                    });
                }
            }
        };
    }])
        ;
