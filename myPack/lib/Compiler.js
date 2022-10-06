const {
    Tapable,
    AsyncSeriesHook,
    SyncBailHook,
    SyncHook,
    AsyncParallelHook
} = require('tapable');
const Compilation = require("./Compilation");
const Stats = require("./Stats");
const path = require("path");
const mkdirp = require("mkdirp");
const NormalModuleFactory = require("./NormalModuleFactory");

class Compiler extends Tapable {
    constructor(context) {
        super();
        this.context = context;
        this.hooks = {
            done : new AsyncSeriesHook(["stats"]),

            entryOption: new SyncBailHook(["context", "entry"]),
			beforeCompile: new AsyncSeriesHook(["params"]),
			compile: new SyncHook(["params"]),
			make: new AsyncParallelHook(["compilation"]),
			afterCompile: new AsyncSeriesHook(["compilation"]),

            beforeRun: new AsyncSeriesHook(["compiler"]),
			run: new AsyncSeriesHook(["compiler"]),
			thisCompilation: new SyncHook(["compilation", "params"]),
			compilation: new SyncHook(["compilation", "params"]),

            emit: new AsyncSeriesHook(["compilation"]),
        }
    }
    emitAssets(compilation, callback){
        // 当前需要做的核心: 01 创建dist 02 在目录创建完成之后执行文件的写操作
        // 01定义一个工具方法 用于执行文件的生成操作
        const emitFiles = (err) => {
            const assets = compilation.assets
            let outputPath = this.options.output.path
            for (const file in assets) {
                let source = assets[file]
                let targetPath = path.posix.join(outputPath, file)
                // 写操作
                compilation.outputFileSystem.writeFileSync(targetPath, source, 'utf8')
            }
            callback(err)
        }
        // 创建目录之后启动文件写入
        this.hooks.emit.callAsync(compilation,(err) => {
            mkdirp.sync(this.options.output.path)
            emitFiles()
        })
    }
    run(callback) {
		console.log('run方法执行了')
        const finalCallback = function (err,stats) {
            callback(err,stats)
        }
        const onCompiled =  (err,compilation) => {
            // 最终将处理好的thunk写入到指定的文件 输出到dist
            this.emitAssets(compilation,(err)=>{
                let stats = new Stats(compilation);
                finalCallback(err,stats)
            })
        }
        this.hooks.beforeRun.callAsync(this,(err)=>{
            this.hooks.run.callAsync(this, err => {
                this.compile(onCompiled);
            });
        })
    }
    newCompilationParams() {
		const params = {
			normalModuleFactory: new NormalModuleFactory(),
		};
		return params;
	}

	createCompilation() {
		return new Compilation(this);
	}

    newCompilation(params) {
		const compilation = this.createCompilation();
		this.hooks.thisCompilation.call(compilation, params);
		this.hooks.compilation.call(compilation, params);
		return compilation;
	}

    compile(callback) {
		const params = this.newCompilationParams();
		this.hooks.beforeRun.callAsync(params, err => {
			this.hooks.compile.call(params);
			const compilation = this.newCompilation(params);
			this.hooks.make.callAsync(compilation, err => {
                // console.log("make钩子监听触发了~~~~~~~")
				// callback(err, compilation);
                // 在这里开始处理chunk
                compilation.seal((err)=>{
                    this.hooks.afterCompile.callAsync(compilation, err => {
                        callback(err,compilation)
                    })
                })
			});
		});
	}
}
module.exports = Compiler