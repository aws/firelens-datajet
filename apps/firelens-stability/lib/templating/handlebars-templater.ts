import { getStringFromFile, sendStringToFile } from "../utils/utils.js";
import handlebars, { template } from "handlebars";


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
* {{#each2 array}}
*   <span>{{_item}}</span>
* {{/each2}}
*/
handlebars.registerHelper('each2', function(arr, block) {
    var accum = '';
    for(var [i, a] of arr.entries()) {
        accum += block.fn({
            ...this,
            _item: a,
            _isLast: (i == (arr.length - 1)),
            _isFirst: (i == 0),
        });
    }
    return accum;
});

/*
* {{#comment}}
*   This comment will not appear once the template is evaluated
* {{/comment}}
*/
handlebars.registerHelper('comment', function(arr, block) {
    return "";
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
    try {
        return handlebars.compile(templateStr, {noEscape: true})(config);
    } catch (e) {
        console.log("Template string failed to be parsed: ", templateStr);
        console.log(JSON.stringify(config, null, 2));
        console.log(e);
    }
}

export async function copyAndTemplateFile(
    sourceFile: string,
    destinationFile: string,
    config: any) {
    const rawFileString = await getStringFromFile(sourceFile);
    const templatedFileString = evaluateTemplateString(rawFileString, {
        // definitions get set to high level for file replacements
        ...(config?.definitions ?? {}),
        ...config
    });
    await sendStringToFile(templatedFileString, destinationFile);
}
