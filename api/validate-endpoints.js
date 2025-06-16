"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Quick validation for UserSettings API endpoints
var user_settings_controller_1 = require("./src/presentation/controllers/user-settings.controller");
console.log('UserSettings API Endpoints Validation:');
console.log('=====================================');
// Get all methods from the controller
var controller = new user_settings_controller_1.UserSettingsController({}, {});
var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
console.log('Available endpoints:');
methods.forEach(function (method) {
    if (method !== 'constructor') {
        console.log("  - ".concat(method));
    }
});
console.log('\n✅ UserSettings controller validation completed!');
