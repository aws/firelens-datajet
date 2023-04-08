import { S3Client } from '@aws-sdk/client-s3';
import S3SyncClient from "s3-sync-client";
import * as Constants from "../constants.js";
import * as Path from "path"
import { nestedPathCreate, s3ArnToAccessPoint } from '../utils/utils.js';

export async function pullArchive(executionContext: IExecutionContext) {
    const archivePath = Path.join(Constants.paths.auto, Constants.folderNames.archives);
    await nestedPathCreate(archivePath);

    // Create a S3 sync client
    const s3Client = new S3Client({});
    const { sync } = new S3SyncClient({ client: s3Client });

    // Sync the local file system with a remote S3 bucket
    const s3AccessPoint = s3ArnToAccessPoint(executionContext.executionConfig.s3ArchivesArn);
    await sync(
        s3AccessPoint,
        archivePath,
        { del: true });
}

export async function pushArchive(executionContext: IExecutionContext) {
    const archivePath = Path.join(Constants.paths.auto, Constants.folderNames.archives);

    // Create a S3 sync client
    const s3Client = new S3Client({});
    const { sync } = new S3SyncClient({ client: s3Client });

    // Sync the local file system with a remote S3 bucket
    await sync(
        archivePath,
        s3ArnToAccessPoint(executionContext.executionConfig.s3ArchivesArn)
    );
}

export async function pullRecords(executionContext: IExecutionContext) {
    const recordsPath = Path.join(Constants.paths.auto, Constants.folderNames.records);
    nestedPathCreate(recordsPath);

    // Create a S3 sync client
    const s3Client = new S3Client({});
    const { sync } = new S3SyncClient({ client: s3Client });

    // Sync the local file system with a remote S3 bucket
    await sync(
        s3ArnToAccessPoint(executionContext.executionConfig.s3RecordArn),
        recordsPath,
        { del: true });
}

export async function pushRecords(executionContext: IExecutionContext) {
    const recordsPath = Path.join(Constants.paths.auto, Constants.folderNames.records);

    // Create a S3 sync client
    const s3Client = new S3Client({});
    const { sync } = new S3SyncClient({ client: s3Client });

    // Sync the local file system with a remote S3 bucket
    await sync(
        recordsPath,
        s3ArnToAccessPoint(executionContext.executionConfig.s3RecordArn));
}
