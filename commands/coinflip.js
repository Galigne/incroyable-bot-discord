module.exports = {
	name: 'coinflip',
	description: 'Lance une pièce et donne le résultat',
	async execute(message) {
        let str = this.doRandHT();
        message.channel.send(str);
    },
    
    doRandHT() {
        var rand = ['PILE','FACE'];
        return rand[Math.floor(Math.random()*rand.length)];
    }
        
};