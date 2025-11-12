export default {
  // Use jsdom for simulating a browser environment
  testEnvironment: "jsdom",

  // Limit Jest to your source folder
  roots: ["<rootDir>/src"],

  // Transpile TypeScript and JSX with Babel
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": ["babel-jest", { configFile: "./babel.config.js" }],
  },

  // Handle CSS, SVG, and other assets
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",

    // 🧩 Ignore all image & font imports
    "\\.(svg|png|jpg|jpeg|gif|eot|ttf|woff|woff2)(\\?.*)?$":
      "<rootDir>/src/__mocks__/svgMock.js",

    // 🧩 Handle Vite-style "?react" SVG imports
    ".*\\?react$": "<rootDir>/src/__mocks__/svgMock.js",

    // Allow absolute imports like src/...
    "^src/(.*)$": "<rootDir>/src/$1",
  },

  // Set up polyfills and jest-dom
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],

  // Ignore non-source folders
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/main.tsx",
    "!src/vite-env.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
};
