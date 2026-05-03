export namespace backend {
	
	export class TeamColorScheme {
	    weapon_main: number;
	    weapon_sec: number;
	    frame_main: number;
	    frame_sec: number;
	    custom_wm_bgra?: number;
	    custom_ws_bgra?: number;
	    custom_fm_bgra?: number;
	    custom_fs_bgra?: number;
	
	    static createFrom(source: any = {}) {
	        return new TeamColorScheme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.weapon_main = source["weapon_main"];
	        this.weapon_sec = source["weapon_sec"];
	        this.frame_main = source["frame_main"];
	        this.frame_sec = source["frame_sec"];
	        this.custom_wm_bgra = source["custom_wm_bgra"];
	        this.custom_ws_bgra = source["custom_ws_bgra"];
	        this.custom_fm_bgra = source["custom_fm_bgra"];
	        this.custom_fs_bgra = source["custom_fs_bgra"];
	    }
	}
	export class ACLoadout {
	    id: string;
	    profile: string;
	    anchorHex: string;
	    tamperHash: string;
	    region: string;
	    part_hashes: Record<string, number>;
	    ai_performance: Record<string, number>;
	    operations_grid: string[][];
	    color_scheme?: TeamColorScheme;
	
	    static createFrom(source: any = {}) {
	        return new ACLoadout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profile = source["profile"];
	        this.anchorHex = source["anchorHex"];
	        this.tamperHash = source["tamperHash"];
	        this.region = source["region"];
	        this.part_hashes = source["part_hashes"];
	        this.ai_performance = source["ai_performance"];
	        this.operations_grid = source["operations_grid"];
	        this.color_scheme = this.convertValues(source["color_scheme"], TeamColorScheme);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CustomRGBRow {
	    Base?: number[];
	    Aid?: number[];
	    Opt?: number[];
	    Det?: number[];
	    Joint?: number[];
	
	    static createFrom(source: any = {}) {
	        return new CustomRGBRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Base = source["Base"];
	        this.Aid = source["Aid"];
	        this.Opt = source["Opt"];
	        this.Det = source["Det"];
	        this.Joint = source["Joint"];
	    }
	}
	export class CustomRGBBlock {
	    General?: CustomRGBRow;
	    Head?: CustomRGBRow;
	    Core?: CustomRGBRow;
	    ArmR?: CustomRGBRow;
	    ArmL?: CustomRGBRow;
	    Legs?: CustomRGBRow;
	
	    static createFrom(source: any = {}) {
	        return new CustomRGBBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.General = this.convertValues(source["General"], CustomRGBRow);
	        this.Head = this.convertValues(source["Head"], CustomRGBRow);
	        this.Core = this.convertValues(source["Core"], CustomRGBRow);
	        this.ArmR = this.convertValues(source["ArmR"], CustomRGBRow);
	        this.ArmL = this.convertValues(source["ArmL"], CustomRGBRow);
	        this.Legs = this.convertValues(source["Legs"], CustomRGBRow);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class PPSTColorScheme {
	    WeaponColors: number[];
	    RGBBlocks: CustomRGBBlock[];
	
	    static createFrom(source: any = {}) {
	        return new PPSTColorScheme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.WeaponColors = source["WeaponColors"];
	        this.RGBBlocks = this.convertValues(source["RGBBlocks"], CustomRGBBlock);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

