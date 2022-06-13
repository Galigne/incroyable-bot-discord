module.exports = {
	name: 'coinflip',
	description: 'Lance une pièce et donne le résultat',
	async execute(message) {
        if (Math.round(Math.random()) == 0) {
            message.channel.send({files: ['media/PILE.gif']});
        } else {
            message.channel.send({files: ['media/FACE.gif']});
        }
    },
};