import { getStringFromFile, sendStringToFile } from "../utils/utils.js";
import handlebars from "handlebars";


/* register handlebars custom templating helpers */
/*
 * {{#times 10}}
 *   <span>{{this}}</span>
 * {{/times}}
 */
handlebars.registerHelper('times', function(n, block) {
    var accum = '';
    for(var i = 0; i < n; ++i) {
        accum += block.fn({
        ...this,
        _idx: i
        });
    }
    return accum;
});

/*
* {{#for 0 10 2}}
*   <span>{{this}}</span>
* {{/for}}
*/
handlebars.registerHelper('for', function(from, to, incr, block) {
    var accum = '';
    for(var i = from; i < to; i += incr) {
        accum += block.fn({
            ...this,
            _idx: i
        });
    }
    return accum;
});

/*
* {{#ifEquals sampleString "This is a string"}}
*  Your HTML here
* {{/ifEquals}}
*/
handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

/* JSON helper */
handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

handlebars.registerHelper('ifEqualsOneOf', function() {
    const arg1 = arguments[1];
    let otherArgs: any[] = [];
    for (let i = 1; i < arguments.length - 1; ++i) {
        otherArgs.push(arguments[i]);
    }
    const options = arguments[arguments.length - 1];
    return otherArgs.some(a => a === arg1) ? options.fn(this) : options.inverse(this);
});

export function evaluateTemplateString(templateStr: string, config: any) {
    return handlebars.compile(templateStr, {noEscape: true})(config);
}

export async function copyAndTemplateFile(
    sourceFile: string,
    destinationFile: string,
    config: any) {
    const rawFileString = await getStringFromFile(sourceFile);
    const templatedFileString = evaluateTemplateString(rawFileString, config);
    await sendStringToFile(templatedFileString, destinationFile);
}
