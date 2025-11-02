"use strict";

import { unlinkSync, writeFileSync } from "fs";
import axios from "axios";
import { convertCsvToXlsx } from "@aternus/csv-to-xlsx";
import "dotenv/config";

const API_KEY = "";

const FACTION_ID_LIST = [20465, 36134, 16335, 10741, 16424, 27902, 11796, 2095, 14633, 9356, 8509];
//const FACTION_ID_LIST = [2095];

const PROXY = {
    proxy: {
        protocol: "http",
        host: "127.0.0.1",
        port: 7890,
    },
};

const TIMESTAMP_START = 1761300000; // 24 October 2025 10:00 TCT
const TIMESTAMP_END = 1761926400; // 31 October 2025 16:00 TCT

main();

async function main() {
    let membersList = [];
    await fetchMemberList(membersList);
    await fetchAttacks(membersList);
    membersList.sort((a, b) => {
        return b.attackswon - a.attackswon;
    });
    const content = writeContent(membersList);

    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let fileName = "万圣节枪数排名2025" + mm + dd;

    try {
        unlinkSync(fileName + ".csv");
        console.log("csv file deleted");
    } catch (error) {}

    try {
        unlinkSync(fileName + ".xlsx");
        console.log("xlsx file deleted");
    } catch (error) {}

    try {
        writeFileSync(fileName + ".csv", content, { flag: "a" });
    } catch (error) {
        console.log(error);
    }

    try {
        convertCsvToXlsx(fileName + ".csv", fileName + ".xlsx");
    } catch (error) {
        console.log(error);
    }

    try {
        unlinkSync(fileName + ".csv");
        console.log("csv file deleted");
    } catch (error) {}
}

async function fetchMemberList(membersList) {
    console.log("fetchMemberList start ");
    for (const factionId of FACTION_ID_LIST) {
        membersList.push.apply(membersList, await fetchFactionMemberList(factionId));
    }
    console.log("fetchMemberList end " + membersList.length);
}

async function fetchFactionMemberList(factionId) {
    const response = await axios.get(`https://api.torn.com/faction/${factionId}?selections=&key=${API_KEY}`, PROXY);
    const body = response.data;
    const factionTag = body.tag;

    let list = [];
    for (const key of Object.keys(body.members)) {
        let member = {};
        member.id = key;
        member.name = body.members[key].name;
        member.level = body.members[key].level;
        member.factionTag = factionTag;
        list.push(member);
    }

    console.log("fetchFactionMemberList done " + factionId + " " + factionTag + " " + list.length);
    return list;
}

async function fetchAttacks(membersList) {
    console.log("fetchAttacks start");
    let failedList = [];

    for (const member of membersList) {
        let body1 = null;
        let body2 = null;
        try {
            await sleep(1500);
            const response1 = await axios.get(
                `https://api.torn.com/user/${member.id}?selections=basic,personalstats&stat=attackswon&timestamp=${TIMESTAMP_START}&key=${API_KEY}`,
                PROXY
            );
            const response2 = await axios.get(
                `https://api.torn.com/user/${member.id}?selections=basic,personalstats&stat=attackswon&key=${API_KEY}`,
                PROXY
            );
            body1 = response1.data;
            body2 = response2.data;
        } catch (error) {
            failedList.push(member);
            process.stdout.write("\r\x1b[K");
            process.stdout.write("Progress: " + member.name + " [" + member.id + "] " + "[ERROR: fetch error]" + " FailedNum: " + failedList.length);
            continue;
        }

        if (
            !body1.player_id ||
            parseInt(body1.player_id) !== parseInt(member.id) ||
            !body2.player_id ||
            parseInt(body2.player_id) !== parseInt(member.id)
        ) {
            failedList.push(member);
            process.stdout.write("\r\x1b[K");
            process.stdout.write(
                "Progress: " + member.name + " [" + member.id + "] " + "[ERROR: playerId inconsistent]" + " FailedNum: " + failedList.length
            );
            continue;
        }

        const attackswon = body2.personalstats.attackswon - body1.personalstats.attackswon;
        member.attackswon = attackswon;
        member.attackswonBefore = body1.personalstats.attackswon;
        member.attackswonAfter = body2.personalstats.attackswon;

        process.stdout.write("\r\x1b[K");
        process.stdout.write(
            "Progress: " +
                member.name +
                " [" +
                member.id +
                "] " +
                " attackswon: " +
                attackswon +
                " " +
                member.attackswonBefore +
                " " +
                member.attackswonAfter +
                " FailedNum: " +
                failedList.length
        );
    }

    if (failedList.length > 0) {
        console.log("\nRetry with failed size: " + failedList.length);
        await fetchAttacks(failedList);
    } else {
        console.log("\nfetchAttacks end");
    }
}

function writeContent(membersList) {
    let content = "";
    content += "ID,Name,Level,Faction,万圣节成功进攻数,节前进攻数,节后进攻数\n";

    for (const member of membersList) {
        content += member.id;
        content += ",";
        content += member.name;
        content += ",";
        content += member.level;
        content += ",";
        content += member.factionTag;
        content += ",";
        content += member.attackswon;
        content += ",";
        content += member.attackswonBefore;
        content += ",";
        content += member.attackswonAfter;
        content += "\n";
    }

    return content;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
