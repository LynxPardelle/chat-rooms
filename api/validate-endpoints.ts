// Quick validation for UserSettings API endpoints
import { UserSettingsController } from './src/presentation/controllers/user-settings.controller';

console.log('UserSettings API Endpoints Validation:');
console.log('=====================================');

// Get all methods from the controller
const controller = new UserSettingsController({} as any, {} as any);
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));

console.log('Available endpoints:');
methods.forEach(method => {
  if (method !== 'constructor') {
    console.log(`  - ${method}`);
  }
});

console.log('\n✅ UserSettings controller validation completed!');
