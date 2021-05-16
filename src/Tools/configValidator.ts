import * as assert from 'assert';
import * as path from 'path';

import { Validator } from 'jsonschema';

assert(process.env.NODE_PATH, 'NODE_PATH env must be specified');

const schemaDir = path.join(path.resolve(process.env.NODE_PATH!), 'config/schema');

const jsonSchemaValidator = new Validator();

const configValidator = (config: object) => {
    const applicationSchema = require(path.join(schemaDir, 'index'));

    Object.keys(applicationSchema.properties).forEach((property: string) => {
        if ('$ref' in applicationSchema.properties[property]) {
            const schema = require(path.join(schemaDir, property));

            jsonSchemaValidator.addSchema(schema, applicationSchema.properties[property].$ref);
        }
    });

    jsonSchemaValidator.validate(config, applicationSchema, {
        throwError: true,
    });
};

export { configValidator };
