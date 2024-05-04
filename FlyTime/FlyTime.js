"use strict";

import { unlinkSync, writeFileSync } from "fs";
import axios from "axios";
import { convertCsvToXlsx } from "@aternus/csv-to-xlsx";
import "dotenv/config";

const API_KEY = process.env.API_KEY;
const FACTION_ID_LIST = [20465, 36134, 16335, 10741, 16424, 27902, 11796, 9356, 8509];
const PROXY = {
    proxy: {
        protocol: "http",
        host: "127.0.0.1",
        port: 7890,
    },
};
const TIMESTAMP_START = Date.now() - 104800000;
const TIMESTAMP_END = TIMESTAMP_START - 604800000; // A week ago.

let scoreMap = new Map();

handle();

async function handle() {
    let membersList = [];
    await fetchMemberList(membersList);
    await fetchBusting(membersList);
    membersList.sort((a, b) => {
        return b.bustNum - a.bustNum;
    });
    const content = writeContent(membersList);

    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let fileName = "上周平均每天飞行时间榜" + mm + dd;

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
    for (const factionId of FACTION_ID_LIST) {
        membersList.push.apply(membersList, await fetchFactionMemberList(factionId));
    }
    console.log("fetchMemberList done " + membersList.length);
}

async function fetchFactionMemberList(factionId) {
    const response = await axios.get(`https://api.torn.com/faction/${factionId}?selections=&key=${API_KEY}`, PROXY);
    const body = response.data;

    const factionTag = body.tag;
    scoreMap.set(factionTag, 0);

    let list = [];
    for (const key of Object.keys(body.members)) {
        let member = {};
        member.id = key;
        member.name = body.members[key].name;
        member.level = body.members[key].level;
        member.factionTag = factionTag;
        list.push(member);
    }

    console.log("fetchFactionMemberList " + factionId + " " + factionTag + " " + list.length);
    return list;
}

async function fetchBusting(membersList) {
    console.log("");
    let failedList = [];

    for (const member of membersList) {
        let body1 = null;
        let body2 = null;
        try {
            const response1 = await axios.get(`https://api.torn.com/user/${member.id}?selections=basic,personalstats&stat=traveltime&timestamp=${TIMESTAMP_END / 1000}&key=${API_KEY}`, PROXY);
            const response2 = await axios.get(`https://api.torn.com/user/${member.id}?selections=basic,personalstats&stat=traveltime&timestamp=${TIMESTAMP_START / 1000}&key=${API_KEY}`, PROXY);
            body1 = response1.data;
            body2 = response2.data;
        } catch (error) {
            failedList.push(member);
            process.stdout.write("\r\x1b[K");
            process.stdout.write("Progress: " + member.id + " [ERROR fetch] " + failedList.length);
            continue;
        }

        if (!body1.player_id || parseInt(body1.player_id) !== parseInt(member.id) || !body2.player_id || parseInt(body2.player_id) !== parseInt(member.id)) {
            failedList.push(member);
            process.stdout.write("\r\x1b[K");
            process.stdout.write("Progress: " + member.id + " [ERROR json ID] " + failedList.length);
            continue;
        }

        const bustNum = (body2.personalstats.traveltime - body1.personalstats.traveltime) / 7 / 60 / 60;
        process.stdout.write("\r\x1b[K");
        process.stdout.write("Progress: " + member.id + " [" + bustNum + "] " + failedList.length);

        member.bustNum = bustNum;

        await sleep(500);
    }

    console.log("\nFailed size: " + failedList.length);
    if (failedList.length > 0) {
        await fetchBusting(failedList);
    }
}

function writeContent(membersList) {
    let content = "";
    content += "ID,Name,Level,Faction,Travel\n";

    for (const member of membersList) {
        content += member.id;
        content += ",";
        content += member.name;
        content += ",";
        content += member.level;
        content += ",";
        content += member.factionTag;
        content += ",";
        content += member.bustNum;
        content += "\n";
    }

    return content;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
