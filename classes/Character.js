class Stats {
    constructor (){
        this.constitution = 0;
        this.force = 0;
        this.dexterite = 0;
        this.intelligence = 0;
        this.vitesse = 0;
        this.perception = 0;
        this.charisme = 0;
    }
}

class Character {
    constructor(name, creatorID){
        this.name = name;
        this.creatorID = creatorID;
        this.HP = 100;
        this.armor = 0;
        this.stats = new Stats();
    }

    toJson(){
        console.log(JSON.stringify(this));
    }
}

module.exports = Character;