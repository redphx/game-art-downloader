import { WebStore } from "./WebStore";

export class SteamStore extends WebStore {
    public override readonly STORE_ID = 'steam';
    protected override readonly MATCH_URL = /https:\/\/store\.steampowered\.com\/app\/(\d+)/;

    public override async extractImages(): Promise<GameArt[]> {
        const match = this.MATCH_URL.exec(window.location.href);
        if (!match) {
            return [];
        }

        const appId = match[1];

        const gameArts: GameArt[] = [];
        try {
            const images = [
                'logo.png',
                'logo_2x.png',
                'header.jpg',
                'header_2x.jpg',
                'library_hero.jpg',
                'library_hero_2x.jpg',
                'library_hero_blur.jpg',
                'library_600x900.jpg',
                'library_600x900_2x.jpg',
                'capsule_616x353.jpg',
                'capsule_231x87.jpg',
                'hero_capsule.jpg',
                'page_bg_raw.jpg',
            ];

            const time = +new Date;
            images.forEach(key => {
                const img = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${key}?t=${time}`;

                gameArts.push({
                    purpose: key.split('.')[0],
                    thumb: img,
                    images: [{
                        src: img,
                        name: key,
                    }],
                });
            });

        } catch (e) {
            console.error(e);
        }

        return gameArts;
    }

    public override generateImageUrl(url: string, width?: number): string {
        return url;
    }
}
