module.exports = {
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
    clearMocks: true,
    collectCoverage: true,
    coverageReporters: ["json", "lcov", "clover", "text"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["/node_modules/"],
    testPathIgnorePatterns: ["/node_modules/"],
    watchPathIgnorePatterns: ["/node_modules/"],
    reporters: [
        "default",
        [
            "jest-junit",
            {
                outputDirectory: "test-reports",
            },
        ],
    ],
    preset: "ts-jest",
    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.jest.json",
        },
    },
};
