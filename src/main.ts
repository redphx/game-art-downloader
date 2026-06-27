// @ts-ignore isolatedModules
import { GogStore } from "./stores/GogStore";
import { NintendoStore } from "./stores/NintendoStore";
import { PlaystationStore } from "./stores/PlaystationStore";
import { WebStore } from "./stores/WebStore";
import { XboxStore } from "./stores/XboxStore";
import { SteamStore } from "./stores/SteamStore";
import mainCss from "./main.css?raw";

const CONFIGS: {
    thumbnail: ThumbnailOptions;
    stores: {
        xbox: WebStoreOptions;
        playstation: WebStoreOptions;
        nintendo: WebStoreOptions;
        gog: WebStoreOptions;
        steam: WebStoreOptions;
    };
} = {
    thumbnail: {
        width: 150,
    },
    stores: {
        // TODO: get these info automatically
        xbox: {
            market: 'US',
            language: 'english',
        },
        playstation: {
            market: 'US',
            language: 'english',
        },
        nintendo: {
            market: 'US',
            language: 'english',
        },
        gog: {
            market: 'US',
            language: 'english',
        },
        steam: {
            market: 'US',
            language: 'english',
        },
    },
};

const STORES = [
    new SteamStore(CONFIGS.stores.steam, CONFIGS.thumbnail),
    new XboxStore(CONFIGS.stores.xbox, CONFIGS.thumbnail),
    new PlaystationStore(CONFIGS.stores.playstation, CONFIGS.thumbnail),
    new NintendoStore(CONFIGS.stores.nintendo, CONFIGS.thumbnail),
    new GogStore(CONFIGS.stores.gog, CONFIGS.thumbnail),
];


const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
const HTML_ENTITY_PATTERN = /[&<>"']/g;

function escape(value: unknown) {
    if (typeof value === 'number') {
        return value;
    }

    const strValue = String(value) as string;
    return strValue.replace(HTML_ENTITY_PATTERN, match => htmlEntities[match]);
}

function renderGameArts(store: WebStore, gameArts: GameArt[]) {
    const $container = document.createElement('div');
    $container.className = 'game-art-downloader';
    $container.dataset.store = store.STORE_ID;

    let html = [];
    html.push(`<div class="header"><span>Game Art Downloader ${__SCRIPT_VERSION__}</span> <a href="https://github.com/redphx/game-art-downloader" target="_blank">github</a></div>`);
    html.push('<div class="game-arts">');

    // Sort game arts by purposes
    gameArts.sort((a, b) => a.purpose > b.purpose ? 1 : -1);

    gameArts.forEach(gameArt => {
        const linksHtml = gameArt.images.map(item => `<a href="${escape(item.src)}" target="_blank">${escape(item.name)}</a>`).join('');

        html.push(`
<div class="game-art">
    <fieldset>
        <legend>${escape(gameArt.purpose)}</legend>
        <img width="${escape(CONFIGS.thumbnail.width)}" src="${escape(gameArt.thumb)}" onerror="gadOnImageError(this)" />

        <div class="links-container">${linksHtml}</div>
    </fieldset>
</div>
`);
    });

    html.push('</div>');

    $container.innerHTML = html.join('');

    document.documentElement.append($container);
    setTimeout(() => $container.scrollIntoView(false), 100);
}

// Remove game art on broken image
(window as any).gadOnImageError = ($img: HTMLImageElement) => {
    const $parent = $img.closest('.game-art')! as HTMLElement;
    $parent.dataset.broken = 'true';
};

// Inject CSS
const $style = document.createElement('style');
$style.innerHTML = mainCss;
document.documentElement.append($style);

let store;
for (store of STORES) {
    if (!store.isValid()) {
        continue;
    }

    const gameArts = await store.extractImages();
    if (gameArts.length) {
        renderGameArts(store, gameArts);
    }
}
