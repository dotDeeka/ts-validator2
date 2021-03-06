import {NotEmptyValidator} from "../validators/not-empty-validator";
import {validatorFactory} from "../utils/validator-factory";
import {IntegerValidator} from "../validators/integer-validator";
import {MinLengthValidator} from "../validators/min-length-validator";
import {MaxLengthValidator} from "../validators/max-length-validator";
import {AllowedValuesValidator} from "../validators/allowed-values-validator";
import {PatternValidator} from "../validators/pattern-validator";
import {MinValidator} from "../validators/min-validator";
import {MaxValidator} from "../validators/max-validator";
import * as _ from 'lodash';

export let attachStaticValidators = function(obj: any, swaggerDef: any) {

    _.forEach(obj._properties, function (propertyName: string) {
        let propDef = swaggerDef.properties[propertyName];
        if (typeof propDef === 'undefined') {
            return;
        }

        if (_.includes(swaggerDef.required, propertyName)) {
            validatorFactory(new NotEmptyValidator())(obj, propertyName);
        }

        if ((propDef.type === 'integer' ||
            propDef.type === 'number') &&
            typeof propDef.enum === 'undefined' && !alreadyHasValidator(obj, propertyName, IntegerValidator)) {

            validatorFactory(new IntegerValidator())(obj, propertyName);
        }

        if (typeof propDef.minLength !== 'undefined' && !alreadyHasValidator(obj, propertyName, MinLengthValidator)) {
            validatorFactory(new MinLengthValidator({minLength: propDef.minLength}))(obj, propertyName);
        }

        if (typeof propDef.maxLength !== 'undefined' && !alreadyHasValidator(obj, propertyName, MaxLengthValidator)) {
            validatorFactory(new MaxLengthValidator({maxLength: propDef.maxLength}))(obj, propertyName);
        }

        if (typeof propDef.enum !== 'undefined' && !alreadyHasValidator(obj, propertyName, AllowedValuesValidator)) {
            validatorFactory(new AllowedValuesValidator({values: propDef.enum}))(obj, propertyName);
        }

        if (typeof propDef.pattern !== 'undefined' && !alreadyHasValidator(obj, propertyName, PatternValidator)) {
            validatorFactory(new PatternValidator({pattern: propDef.pattern}))(obj, propertyName);
        }

        if (typeof propDef.minimum !== 'undefined' && !alreadyHasValidator(obj, propertyName, MinValidator)) {
            validatorFactory(new MinValidator({min: propDef.minimum}))(obj, propertyName);
        }

        if (typeof propDef.maximum !== 'undefined' && !alreadyHasValidator(obj, propertyName, MaxValidator)) {
            validatorFactory(new MaxValidator({max: propDef.maximum}))(obj, propertyName);
        }

    });

};


/**
 * Decorator function
 */
export let SwaggerDef = function(swaggerDef: any, fullSwaggerDef?) {
    return function (target: any) {
        if (!_.isEqual(_.keys(swaggerDef.properties).sort(), getSortedServerProperties(target))) {
            console.error('Swagger definition', swaggerDef);
            console.error('Model Properties', target.prototype._properties);
            throw new Error(target.name + ' Properties did not match properties in the Swagger definition');
        }

        attachStaticValidators(target.prototype, swaggerDef);

        if (swaggerDef.discriminator) {
            target.prototype._discriminator = swaggerDef.discriminator;
            attachDynamicValidator(target, swaggerDef.discriminator, swaggerDef, fullSwaggerDef);
        }
    };

};

function getSortedServerProperties(target: any) {
    const ret = [];
    for (let i = 0; i < target.prototype._properties.length; i++) {
        let prop = target.prototype._properties[i];

        if (!target.prototype._ignoreProperties || !target.prototype._ignoreProperties[prop]) {
            ret.push(prop);
        }
    }

    return ret.sort();
}

function attachDynamicValidator(target: any, discriminator, swaggerDef, fullSwaggerDef) {


    /**
     * TODO(derek): Make this work if the model already implements
     * a setter/getter for this property
     */
    const newConstructor = function () {

        Object.defineProperty(this, discriminator, {
            get: function() {
                return this['_' + discriminator];
            },
            set: function (newValue) {

                if (this['_' + discriminator] !== newValue) {
                    this.updateValidatorsOnDiscriminatorChange(newValue, swaggerDef, fullSwaggerDef);
                    this['_' + discriminator] = newValue;

                }
            }
        });

        target.prototype.constructor.apply(this, arguments);
    };

    newConstructor.prototype = target.prototype;

    return newConstructor;
};




/**
 * TODO(derek): Consider re-implementing storing validators in a map instead of an array to make this
 * loop go away
 */
function alreadyHasValidator(obj, propertyName: string, validator): boolean {
    if (typeof obj._validators === 'undefined' || typeof obj._validators[propertyName] === 'undefined') {
        return false;
    } else {
        for (let i = 0; i < obj._validators[propertyName].length; i++) {
            let existingValidator = obj._validators[propertyName][i];
            if (existingValidator instanceof validator) {
                return true;
            }
        }
    }

    return false;
}
