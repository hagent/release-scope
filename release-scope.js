#!/usr/bin/env node

const fetch = require('isomorphic-fetch')
const { execSync } = require('child_process');
const pjson = require('./package.json');
console.log('script version: ' + pjson.version);

async function getReleaseHash() {
    const releaseHash = await (await fetch('https://www.worldremit.com/public-assets/utils/cms_version.json')).json();
    return releaseHash.commit.substr(0, 9);
}

function execEcho(cmd, options) {
    console.log(cmd);
    return execSync(cmd, options);
}

function getCommitHashes(branch, fromIndex = 0) {
    const branchName = branch ? `origin/${branch}` : branch;
    return execEcho(`git log ${branchName} --format='%h'`, { encoding: 'utf-8' })
        .split('\n')
        .splice(fromIndex);
}

function getCommitMessages(branch, fromIndex = 0) {
    const branchName = branch ? `origin/${branch}` : branch;
    return execEcho(`git log ${branchName} --format='%s'`, { encoding: 'utf-8' })
        .split('\n')
        .splice(fromIndex);
}

function getCurrentBranch() {
    return execEcho(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf-8' }).trim();
}

async function main() {
    const [, , releaseBranch = getCurrentBranch(), masterBranch = 'master'] = process.argv;

    execEcho(`git fetch`);
    const releaseBranchHistory = getCommitHashes(releaseBranch);
    const masterBranchHistory = getCommitHashes(masterBranch);
    const releaseHash = await getReleaseHash();
    // it's possible that release branch has unreleased changes, 
    // before releaseCommitIndex index everythins is really released
    const releaseCommitIndex = releaseBranchHistory.indexOf(releaseHash);
    if (releaseCommitIndex === -1) {
        throw new Error(`release hash ${releaseHash} wasnt found in release branch logs, first 30:
${releaseBranchHistory.slice(0, 30)}`)
    }
    console.log('last released commit index in release branch', releaseCommitIndex, 'release commit itself', releaseHash)
    const releasedCommitMessagesSet = new Set(getCommitMessages(releaseBranch, releaseCommitIndex));
    const masterCommitMessages = getCommitMessages(masterBranch)
        .map((message, ind) => ({ message, ind })); // + "ind" field to save original index
    const messagesNotInReleaseBranch = masterCommitMessages.filter(({ message }) => !releasedCommitMessagesSet.has(message))
    console.log('unreleased changes:')
    console.log(messagesNotInReleaseBranch.map(({ message, ind }) => `${masterBranchHistory[ind]} ${message}`).join('\n'))
    const jiraNumbers = messagesNotInReleaseBranch
        .filter(x => x.message.includes(':'))
        .map(x => x.message.split(':')[0]);
    const uniqJiraNumbers = new Set(jiraNumbers);
    const jiraTickets = [...uniqJiraNumbers]
        .sort()
        .map(x => `https://worldremit.atlassian.net/browse/${x}`);
    console.log('\njira tickets:')
    console.log(jiraTickets.join('\n'));
}


main()
