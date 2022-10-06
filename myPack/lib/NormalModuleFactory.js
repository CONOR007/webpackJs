const NormalModule = require('./NormalModule')
module.exports = class NormalModuleFactory {
    constructor(){
    }
	create(data) {
        return new NormalModule(data);
	}
};