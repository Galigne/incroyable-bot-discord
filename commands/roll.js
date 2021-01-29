module.exports = {
	name: 'roll',
	description: 'Lance un dé et donne le résultat',
	async execute(message) {
        const args = message.content.split(' ');
		let maxRoll = 0;
		try {
			maxRoll = parseInt(args[1], 10);
		}catch(err) {
			return message.reply('Donnez la valeur du lancé de dé. (max 1000)')
        }
        
        if (!maxRoll || maxRoll < 2 || maxRoll > 1000)
            return message.reply('Donnez la valeur du lancé de dé. (entre 2 et 1000)');
            
        let rollValue = Math.floor(Math.random()*maxRoll)
        message.channel.send("You rolled a " + rollValue);
    },   
};