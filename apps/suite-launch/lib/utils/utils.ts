import { promises as fs } from 'fs';
import * as Path from "path";

export async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export function makeId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

export async function sendStringToFile(str: string, filePath: string) {
    return (await fs.writeFile(filePath, str));
}

export async function sendJSONToFile(json: any, filePath: string) {
    return await sendStringToFile(JSON.stringify(json, null, 2), filePath);
}

export async function getStringFromFile(filePath: string) {
    return (await fs.readFile(filePath)).toString();
}

export async function templateString(str: string, template: {[key: string]: any}) {
    return str;
}

export async function getJsonFromFile(filePath: string) {
    const fileString = (await fs.readFile(filePath)).toString();
    return JSON.parse(fileString);
}

export async function getSubFolders(path: string) {
    return (await fs.readdir(path, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => Path.join(path, dirent.name))
}

export async function getSubFiles(path: string) {
    return (await fs.readdir(path, { withFileTypes: true }))
        .filter(dirent => dirent.isFile())
        .map(dirent => Path.join(path, dirent.name))
}

export async function getSubConfig(path: string) {

    return await fs.readdir(path);
}

export function s3ArnToBucketAndPath(s3Arn: string) {
    const s3Resources = s3Arn.split("arn:aws:s3:::")[1];
    const s3Bucket = s3Resources.split("/")[0];
    const s3Path   = s3Resources.split("/").splice(1).join("/");

    return {
        s3Bucket,
        s3Path,
    };
}

export function s3ArnToAccessPoint(s3Arn: string) {
    const {
        s3Bucket,
        s3Path,
    } = s3ArnToBucketAndPath(s3Arn);
    
    return `s3://${s3Bucket}${(s3Path === "") ? "" : "/"}${s3Path}`;
}

export async function nestedPathCreate(path: string) {
    await fs.mkdir(path, { recursive: true })
}
