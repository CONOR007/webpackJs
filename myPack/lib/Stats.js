module.exports = class Stats {
    constructor(compliantion){
        this.entries = compliantion.entries;
        this.modules = compliantion.modules;
        this.chunks = compliantion.chunks;
        this.files = compliantion.files;
    }
    toJson(){
        return this
    }
}