module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  moduleDirectories: ['node_modules', 'src'],
  roots: ['<rootDir>/client/src'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
