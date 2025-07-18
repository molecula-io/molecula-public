export enum BuildType {
    Local = 'local', // This is a local one, not sent to CI
    Dev = 'dev',
    Alpha = 'alpha',
    Beta = 'beta',
    Prod = 'prod',
}

enum Keys {
    BUILD_TYPE = 'BUILD_TYPE',
    NODE_ENV = 'NODE_ENV',
}

const customEnv: { [key: string]: unknown } = {};

export class Environment {
    /**
     * A setter for the custom environment.
     * @param env - a custom environment object.
     */
    public static setEnv(env: { [key: string]: unknown }) {
        Object.assign(customEnv, env);
    }

    /**
     * A current build type.
     */
    public static get buildType(): BuildType {
        return (
            // Check for "BUILD_TYPE" env variable first
            (this.getEnv(Keys.BUILD_TYPE, process.env.BUILD_TYPE) as BuildType) ||
            // Check for React App which can use only variables with `REACT_APP_` prefix
            (this.getEnv(Keys.BUILD_TYPE, process.env.REACT_APP_BUILD_TYPE) as BuildType) ||
            // Fallback to `Local` build type in case the variable is not passed
            BuildType.Local
        );
    }

    /**
     * A flag either the current build type is ".Dev".
     */
    public static get isDevStand(): boolean {
        return this.buildType === BuildType.Dev;
    }

    /**
     * A flag either the current build type is ".Alpha".
     */
    public static get isAlpha(): boolean {
        return this.buildType === BuildType.Alpha;
    }

    /**
     * A flag either the current build type is ".Beta".
     */
    public static get isBeta(): boolean {
        return this.buildType === BuildType.Beta;
    }

    /**
     * A flag either the current build type is ".Prod".
     */
    public static get isProd(): boolean {
        return this.buildType === BuildType.Prod;
    }

    /**
     * A flag either the current environment is a development one.
     */
    public static get isDevelopment(): boolean {
        return this.getEnv(Keys.NODE_ENV, process.env.NODE_ENV) === 'development';
    }

    /**
     * A flag either the current environment is a production one.
     * Note: do not mix with {@link isProd} flag.
     */
    public static get isProduction(): boolean {
        return this.getEnv(Keys.NODE_ENV, process.env.NODE_ENV) === 'production';
    }

    // Internals

    /**
     * A private getter for the current environment property.
     * @param key - a key to get the value for.
     * @param defaultValue - a default value.
     * @returns a string property.
     */
    private static getEnv(key: string, defaultValue?: string): string {
        return `${customEnv[key] || defaultValue || ''}`.toLowerCase();
    }
}
