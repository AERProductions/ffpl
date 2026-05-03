export namespace backend {
	
	export class ACLoadout {
	    profile: string;
	    anchorHex: string;
	    part_hashes: Record<string, number>;
	    ai_performance: Record<string, number>;
	    operations_grid: string[][];
	
	    static createFrom(source: any = {}) {
	        return new ACLoadout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profile = source["profile"];
	        this.anchorHex = source["anchorHex"];
	        this.part_hashes = source["part_hashes"];
	        this.ai_performance = source["ai_performance"];
	        this.operations_grid = source["operations_grid"];
	    }
	}

}

