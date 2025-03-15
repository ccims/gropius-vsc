/**
 * Sample file for testing artifact creation
 */

// Basic function for demonstration
function calculateSum(a, b) {
  // This comment can be part of your artifact
  const result = a + b;
  return result;
}

// A more complex example
class ArtifactTest {
  constructor(name) {
    this.name = name;
    this.createdAt = new Date();
  }

  // Method to generate a greeting
  greet() {
    return `Hello from ${this.name}!`;
  }

  // Another method to demonstrate code selection
  performOperation(x, y, operation) {
    switch (operation) {
      case 'add':
        return x + y;
      case 'subtract':
        return x - y;
      case 'multiply':
        return x * y;
      case 'divide':
        if (y === 0) {
          throw new Error('Division by zero');
        }
        return x / y;
      default:
        throw new Error('Unknown operation');
    }
  }
}

// Create an instance and use it
const tester = new ArtifactTest('Artifact Tester');
console.log(tester.greet());
console.log(`2 + 3 = ${tester.performOperation(2, 3, 'add')}`);

// Export for potential use elsewhere
module.exports = {
  calculateSum,
  ArtifactTest
};