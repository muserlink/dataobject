import { PropertyDecoratorOptions } from './PropertyDecoratorOptions';
import { ClassWithToPlain, TYPE_ATTRIBUTE_NAME, ToPlainFunction } from './types';
import { Decorator } from './Decorator';
import { inContext } from './in-context';
import { assumeType } from './assume-type';

export class ToPlain {
  /**
   * Transform each value.
   */
  static transform(value: unknown, context: string, options?: PropertyDecoratorOptions): unknown {
    if (Array.isArray(value)) {
      return (value as unknown[]).map((v) => this.transform(v, context, options));
    }
    if (options?.transformer?.to) {
      return options.transformer.to(value);
    }
    if (value === undefined) {
      return undefined;
    }
    if (options?.type) {
      const type = assumeType(options.type(), value);
      const ret = (type as ClassWithToPlain<InstanceType<typeof type>>).toPlain(value, context);
      if (!ret[TYPE_ATTRIBUTE_NAME]) {
        ret[TYPE_ATTRIBUTE_NAME] = type.name;
      }
      return ret;
    }
    return value;
  }

  /**
   * Create toPlain() method.
   * @param ctor the class
   * @param toPlainOptions several options
   */
  static createToPlain<T>(ctor: new () => T, toPlainOptions?: ToPlainOptions): ToPlainFunction<T> {
    return (obj: T, _context?: string) => {
      const properties = Decorator.getPropertyMap(obj);
      if (!properties) {
        return {};
      }

      let ret: Record<string, unknown> = {};
      properties.forEach((options, _key) => {
        const context = _context || 'toPlain';
        if (!inContext(context, options?.context)) {
          return; // skip, out of context
        }
        const key = _key as string & keyof T;
        const objValue = obj[key];
        if (objValue === undefined && toPlainOptions?.omitUndefined !== false) {
          return; // skip, because the value is undefined
        }
        const transformed = ToPlain.transform(objValue, context, options);
        if (transformed === undefined && toPlainOptions?.omitUndefined !== false) {
          return; // skip, because the transformed value is undefined.
        }
        if (
          typeof transformed === 'object' &&
          options?.spread &&
          inContext(context, options.spread.context)
        ) {
          ret = { ...transformed, ...ret };
        } else {
          ret[key] = transformed;
        }
      });
      return ret;
    };
  }
}

export interface ToPlainOptions {
  /**
   * Omit (remove) entries which have `undefined` as its value.
   * Note: Not-set (undefined) is same as `true`.
   */
  omitUndefined?: boolean;
}
