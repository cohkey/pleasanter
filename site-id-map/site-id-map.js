// ========================================
// 共通_サイトIDマップ取得
// ========================================

// サイトIDマスタのサイトID
// 同じPleasanter環境内で共通のため、このIDだけ直書きする。
const SITE_ID_MASTER_SITE_ID = 999999;

const SITE_ID_MASTER_FIELDS = {
    siteKey: 'ClassA',
    devSiteId: 'NumA',
    stgSiteId: 'NumB',
    prodSiteId: 'NumC'
};

const ENV_SITE_ID_FIELDS = {
    dev: SITE_ID_MASTER_FIELDS.devSiteId,
    stg: SITE_ID_MASTER_FIELDS.stgSiteId,
    prod: SITE_ID_MASTER_FIELDS.prodSiteId
};

const SITE_ID_MAP_CACHE_KEY = 'siteIdMap';
const SITE_ENV_CACHE_KEY = 'siteEnv';

/**
 * サイトIDマスタからサイトIDマップを取得する。
 *
 * 現在の context.SiteId が dev / stg / prod のどの列に存在するかで環境を自動判定する。
 * 同一SS実行中に再度呼ばれた場合は、context.UserData のキャッシュを返す。
 *
 * @param {Object} context Pleasanterのcontext
 * @returns {Object} サイトキーをキーにしたサイトIDマップ
 */
function getSiteIdMap(context) {
    if (context.UserData[SITE_ID_MAP_CACHE_KEY]) {
        return context.UserData[SITE_ID_MAP_CACHE_KEY];
    }

    const records = items.Get(SITE_ID_MASTER_SITE_ID);
    const env = detectSiteEnv(records, context.SiteId);
    const siteIdMap = buildSiteIdMap(records, ENV_SITE_ID_FIELDS[env]);

    context.UserData[SITE_ID_MAP_CACHE_KEY] = siteIdMap;
    context.UserData[SITE_ENV_CACHE_KEY] = env;

    return siteIdMap;
}

/**
 * 現在のサイトIDから、実行環境を判定する。
 *
 * @param {Array<Object>} records サイトIDマスタのレコード一覧
 * @param {number|string} currentSiteId 現在実行中のサイトID
 * @returns {string} dev / stg / prod
 */
function detectSiteEnv(records, currentSiteId) {
    const siteId = Number(currentSiteId);

    for (const env in ENV_SITE_ID_FIELDS) {
        const siteIdField = ENV_SITE_ID_FIELDS[env];

        const found = records.some(function(record) {
            return Number(record[siteIdField]) === siteId;
        });

        if (found) {
            return env;
        }
    }

    throw new Error(
        'サイトIDマスタから実行環境を判定できません。' +
        ' currentSiteId=' + siteId
    );
}

/**
 * サイトIDマスタのレコード一覧から、指定環境のサイトIDマップを作成する。
 *
 * @param {Array<Object>} records サイトIDマスタのレコード一覧
 * @param {string} siteIdField 使用するサイトID項目 NumA / NumB / NumC
 * @returns {Object} サイトIDマップ
 */
function buildSiteIdMap(records, siteIdField) {
    const map = {};
    const usedKeys = {};
    const usedIds = {};

    records.forEach(function(record) {
        const siteKey = record[SITE_ID_MASTER_FIELDS.siteKey];
        const siteId = Number(record[siteIdField]);

        // サイトキー未設定の行は無視する
        if (!siteKey) {
            return;
        }

        if (!siteId) {
            throw new Error('サイトIDが未設定です。siteKey=' + siteKey);
        }

        if (usedKeys[siteKey]) {
            throw new Error('サイトキーが重複しています。siteKey=' + siteKey);
        }

        if (usedIds[siteId]) {
            throw new Error(
                '同じ環境内でサイトIDが重複しています。' +
                ' siteId=' + siteId +
                ', siteKey1=' + usedIds[siteId] +
                ', siteKey2=' + siteKey
            );
        }

        usedKeys[siteKey] = true;
        usedIds[siteId] = siteKey;
        map[siteKey] = siteId;
    });

    return map;
}

/**
 * 現在判定されている環境名を取得する。
 *
 * getSiteIdMap(context) を先に呼んでいない場合は、内部で呼び出す。
 *
 * @param {Object} context Pleasanterのcontext
 * @returns {string} dev / stg / prod
 */
function getSiteEnv(context) {
    if (!context.UserData[SITE_ENV_CACHE_KEY]) {
        getSiteIdMap(context);
    }

    return context.UserData[SITE_ENV_CACHE_KEY];
}

/**
 * 現在実行中のサイトIDが、指定したサイトキーのサイトIDと一致するか確認する。
 *
 * @param {Object} context Pleasanterのcontext
 * @param {Object} siteIdMap サイトIDマップ
 * @param {string} siteKey サイトキー
 */
function assertCurrentSite(context, siteIdMap, siteKey) {
    const expectedSiteId = siteIdMap[siteKey];
    const actualSiteId = Number(context.SiteId);

    if (!expectedSiteId) {
        throw new Error('サイトキーがサイトIDマップに存在しません。siteKey=' + siteKey);
    }

    if (actualSiteId !== expectedSiteId) {
        throw new Error(
            '実行サイトが想定と違います。' +
            ' siteKey=' + siteKey +
            ', expected=' + expectedSiteId +
            ', actual=' + actualSiteId
        );
    }
}