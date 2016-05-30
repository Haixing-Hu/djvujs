'use strict';

class DIRMChunk extends IFFChunk {
    constructor(bs) {
        super(bs);
        this.dflags = bs.byte();
        this.nfiles = bs.getInt16();
        this.offsets = [];
        this.sizes = [];
        this.flags = [];
        this.ids = [];
        for (var i = 0; i < this.nfiles; i++) {
            this.offsets.push(bs.getInt32());
        }
        var bsbs = bs.fork(this.length - 3 - 4 * this.nfiles);
        var bzz = new BZZDecoder(new ZPCoder(bsbs));
        var bsz = bzz.getByteStream();
        for (var i = 0; i < this.nfiles; i++) {
            this.sizes.push(bsz.getUint24());
        }
        for (var i = 0; i < this.nfiles; i++) {
            this.flags.push(bsz.byte());
        }
        for (var i = 0; i < this.nfiles && !bsz.isEmpty(); i++) {
            //todo проверять hasname и hastitle
            this.ids.push(bsz.readStrNT());
        }
    }
    toString() {
        var str = this.id + " " + this.length + '\n';
        str += "Files: " + this.nfiles + '\n';
        /*str += "offsets: ";
        this.offsets.forEach(item=>str+=item+" ");
        str += '\n';
        str += "sizes: ";
        str += this.sizes.join(' ') + '\n';
        str += "flags: ";
        str += this.flags.join(' ') + '\n';
        str += "ids: ";
        str += this.ids.join(' ') + '\n\n';*/
        return str + '\n';
    }
}

class DjVuDocument {
    constructor(arraybuffer) {
        this.buffer = arraybuffer;
        this.bs = new ByteStream(arraybuffer);
        this.formatID = this.bs.readStr4();
        this.id = this.bs.readStr4();
        this.length = this.bs.getInt32();
        this.id += this.bs.readStr4();
        if (this.id == 'FORMDJVM') {
            var id = this.bs.readStr4();
            var length = this.bs.getInt32();
            this.bs.jump(-8);
            this.dirm = new DIRMChunk(this.bs.fork(length + 8));
            this.bs.jump(8 + length + (length & 1 ? 1 : 0));
        }
        Globals._doc = this;
        Globals.getINCLChunk = function(id) {
            return Globals._doc.djvi[id].innerChunk;
        }
        //страницы FORMDJVU
        this.pages = [];
        //разделяемые ресурсы
        this.djvi = {};
        
        if (this.dirm) {
            var id = this.bs.readStr4();
            var length = this.bs.getInt32();
            this.bs.jump(-8);
            if (id == 'NAVM') {
                this.navm = new NAVMChunk(this.bs.fork(length + 8))
            }
            for (var i = 0; i < this.dirm.offsets.length; i++) {
                this.bs.setOffset(this.dirm.offsets[i]);
                var id = this.bs.readStr4();
                var length = this.bs.getInt32();
                id += this.bs.readStr4();
                this.bs.jump(-12);
                switch (id) {
                case "FORMDJVU":
                    this.pages.push(new DjVuPage(this.bs.fork(length + 8)));
                    break;
                case "FORMDJVI":
                    //через строчку id chunk INCL ссылается на нужный ресурс
                    this.djvi[this.dirm.ids[i]] = new DjViChunk(this.bs.fork(length + 8));
                    break;
                default:
                    console.log(id);
                }
            }
        } 
        else {
            this.bs.jump(-12);
            this.pages.push(new DjVuPage(this.bs.fork(this.length + 8)));
        }
    }
    
    
    countFiles() {
        var count = 0;
        var bs = this.bs.clone();
        bs.jump(16);
        while (!bs.isEmpty()) {
            var chunk;
            var id = bs.readStr4();
            var length = bs.getInt32();
            bs.jump(-8);
            // вернулись назад
            var chunkBs = bs.fork(length + 8);
            // перепрыгнули к следующей порции
            bs.jump(8 + length + (length & 1 ? 1 : 0));
            if (id === 'FORM') {
                count++;
            }
        }
        return count;
    }
    
    toString() {
        var str = this.formatID + '\n';
        if (this.dirm) {
            str += this.id + " " + this.length + '\n';
            str += this.dirm.toString();
        }
        
        if (this.navm) {
            str += this.navm.toString();
        }
        
        for (var prop in this.djvi) {
            str += this.djvi[prop];
        }
        this.pages.forEach(item=>str += item.toString());
        str = str.replace(/\n/g, '<br>');
        return str;
    }
    
    createObjectURL() {
        var blob = new Blob([this.bs.buffer]);
        var url = URL.createObjectURL(blob);
        return url;
    }
    
    // создает новый документ со страницы from включая ее до to невключая
    slice(from, to) {
        Globals.Timer.start('sliceTime');
        from = from || 0;
        to = to || this.pages.length;
        var djvuWriter = new DjVuWriter();
        djvuWriter.startDJVM();
        var dirm = {};
        dirm.dflags = this.dirm.dflags;
        var pageNumber = to - from;
        dirm.flags = [];
        dirm.sizes = [];
        dirm.ids = [];
        var chuckBS = [];
        var pageCount = 0;
        var addedPageCount = 0;
        // все зависимости страниц в новом документе
        // нужно чтобы не копировать лишние словари
        var dependencies = {};
        
        // находим все зависимости в первом проходе
        for (var i = 0; i < this.dirm.nfiles && addedPageCount < pageNumber; i++) {
            //если это страница
            if (this.dirm.flags[i] & 1) {
                pageCount++;
                //если она не входит в заданный дапазон
                if (!(addedPageCount < pageNumber && pageCount > from)) {
                    continue;
                } 
                else {
                    addedPageCount++;
                    var cbs = new ByteStream(this.buffer,this.dirm.offsets[i],this.dirm.sizes[i]);
                    var deps = new DjVuPage(cbs).getDependencies();
                    cbs.reset();
                    for (var j = 0; j < deps.length; j++) {
                        dependencies[deps[j]] = 1;
                    }
                }
            }
        }
        
        pageCount = 0;
        addedPageCount = 0;
        // теперь все словари и страницы, которые нужны
        for (var i = 0; i < this.dirm.nfiles && addedPageCount < pageNumber; i++) {
            //если это страница
            if (this.dirm.flags[i] & 1) {
                pageCount++;
                //если она не входит в заданный дапазон
                if (!(addedPageCount < pageNumber && pageCount > from)) {
                    continue;
                } 
                else {
                    addedPageCount++;
                }
            }
            
            //копируем страницы и словари. Эскизы пропускаем - пока что это не реализовано
            if (this.dirm.ids[i] in dependencies || this.dirm.flags[i] & 1) {
                dirm.flags.push(this.dirm.flags[i]);
                dirm.sizes.push(this.dirm.sizes[i]);
                dirm.ids.push(this.dirm.ids[i]);
                var cbs = new ByteStream(this.buffer,this.dirm.offsets[i],this.dirm.sizes[i]);
                chuckBS.push(cbs);
            }
            
            if (!(this.dirm.ids[i] in dependencies) && !(this.dirm.flags[i] & 1)) {
                console.log("Excess dict ", this.dirm.ids[i]);
            }
        }
        
        djvuWriter.writeDirmChunk(dirm);
        if(this.navm) {
            djvuWriter.writeChunk(this.navm);
        }
        
        for (var i = 0; i < chuckBS.length; i++) {
            djvuWriter.writeFormChunkBS(chuckBS[i]);
        }
        var newbuffer = djvuWriter.getBuffer();
        console.log("New Buffer size = ", newbuffer.byteLength);
        var doc = new DjVuDocument(newbuffer);
        Globals.Timer.end('sliceTime');
        return doc;
    }
}
