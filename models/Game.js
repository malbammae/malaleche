import _ from "lodash"
import { getShuffledACard, getShuffledQCard } from "./Card"

class Game {
  constructor(partyCode, roundLength = 60, roundFinishedNotifier = () => { }) {
    this.partyCode = partyCode;
    this.gameStartDate = new Date();
    this.QCardDeck = getShuffledQCard();//.slice(0, 2);
    this.ACardDeck = getShuffledACard();//.slice(0, 11);
    this.players = {};
    this.rounds = [];
    this.roundLength = roundLength;
    this.roundFinishedNotifier = roundFinishedNotifier;
    this.roundTimer = 0;

    this.addNewPlayer = this.addNewPlayer.bind(this);
    this.getPlayer = this.getPlayer.bind(this);
    this.getLatestRound = this.getLatestRound.bind(this);
    this.getPlayerRoundState = this.getPlayerRoundState.bind(this);
    this.endRound = this.endRound.bind(this);
  }

  addNewPlayer(name, sessionID) {
    if (name == undefined || sessionID == undefined) {
      console.log(`trying to addNewPlayer to ${this.partyCode}`)
    }
    else if (this.ACardDeck.length < 3) { // remove this
      console.log('Cannot add new player to deck, ACardDeck has ran out of cards!')
    }
    else {
      this.players[sessionID] = {
        name,
        pID: _.size(this.players),
        roundsWon: [],
        cards: this.ACardDeck.splice(0, 10),
        roundState: "lobby"
      };
    }
  }

  // return the player in the game, if exists, else return null
  getPlayer(sessionID) {
    return this.players[sessionID] ? this.players[sessionID] : null;
  }

  // get the latest active round or create a new empty round (if its the first round, or )
  // O(max(m,n,k)), m=size QCardDeck, n=size ACardDeck, k=# of players
  getLatestRound() {
    if (_.size(this.players) < 3) { // O(1)
      console.log("Cannot getLatestRound. not enough players to start a game")
      return
    }
    else if (this.rounds.length === 0 || !(this.rounds.slice(-1)[0].active)) { // O(1)
      console.log('creating new round, since old round was not active (or this is the first round)')
      // shuffle the decks
      this.QCardDeck = _.shuffle(this.QCardDeck);
      this.ACardDeck = _.shuffle(this.ACardDeck);

      let round = {
        active: true,
        roundNum: this.rounds.length + 1,
        roundState: "players-selecting",
        roundStartTime: new Date(),
        roundEndTime: null,
        roundJudge: _.find(this.players, player => player.pID === (this.rounds.length % _.size(this.players))), // O(k), k is constant size number of players
        QCard: _.take(this.QCardDeck)[0],
        otherPlayerCards: [],
        winningCard: null,
        winner: null,
      }

      this.roundTimer = setTimeout(() => {
        round.roundState = 'judge-selecting'
        console.log('Judge-selection time!')
        this.roundFinishedNotifier(true, 'Judge-selection time!')
      }, this.roundLength * 1000);

      this.rounds.push(round);
      return round;
    }
    else {
      console.log(`returning latest active round`)
      return this.rounds.slice(-1)[0] // O(1)
    }
  }

  // return true if player with session id is round judge
  isRoundJudge(sessionID, round) {
    let player = this.getPlayer(sessionID);
    return player && round.roundJudge.pID === player.pID;
  }

  // Return the round state for the player with given sessionID
  getPlayerRoundState(sessionID) {
    let player = this.getPlayer(sessionID)
    if (player == null) return null;
    let latestRound = this.getLatestRound()
    let roundRole = this.isRoundJudge(sessionID, latestRound) ? 'judge' : 'player'
    let playerChoice = _.find(latestRound.otherPlayerCards, card => card.owner.pID === player.pID) || null;
    let otherPlayerCards = latestRound.otherPlayerCards;
    let cards = player.cards;
    let QCard = latestRound.QCard;
    let roundNum = latestRound.roundNum;
    let roundJudge = latestRound.roundJudge.name;
    let winningCard = latestRound.winningCard;
    let winner = latestRound.winner;
    let timeLeft = _.max([0, _.floor(this.roundLength - ((new Date() - latestRound.roundStartTime) / 1000))]); // timeRemaining in seconds
    let roundState;

    if (latestRound.roundState === 'judge-selecting' || latestRound.roundState === 'viewing-winner') {
      timeLeft = 0
      roundState = latestRound.roundState
    }
    else if (roundRole == 'judge') {
      roundState = 'judge-waiting'
    }
    else if (playerChoice != null) {
      roundState = 'player-waiting'
    }
    else {
      roundState = 'player-selecting'
    }

    return {
      roundState,
      roundRole,
      roundJudge,
      roundNum,
      QCard,
      cards,
      otherPlayerCards,
      playerChoice,
      winningCard,
      winner,
      timeLeft
    }
  }

  playCard(sessionID, cardID, cb) {
    let player = this.getPlayer(sessionID);
    if (player == null) return;
    let card = _.find(player.cards, c => c.id === cardID)
    let latestRound = this.getLatestRound()

    if (latestRound.roundState != 'players-selecting') {
      cb(false, "Cannot play card!, judge is currently selecting!")
    }
    else if (this.isRoundJudge(sessionID, latestRound)) {
      cb(false, `${player.name} cannot play a card this round since they are the judge`)
    }

    // if they own the cardID they want to play, play the card for the latest round
    if (card) {
      _.remove(player.cards, c => c.id === cardID)
      // add card to otherPlayerCards
      latestRound.otherPlayerCards.push({ ...card, owner: { "name": player.name, "pID": player.pID } })
      // give player a new card. TODO: error handle if ACardDeck is empty
      player.cards = player.cards.concat(this.ACardDeck.splice(0, 1))
      // player.
      if (latestRound.otherPlayerCards.length === (_.size(this.players) - 1)) {
        latestRound.roundState = 'judge-selecting'
        clearTimeout(this.roundTimer)
        this.roundFinishedNotifier(true, 'all players have played their cards, going to judge-selecting!')
        cb(true, `${player.name} was last player to play cards, going to judge-selecting!`)
      } else {
        cb(true, `${player.name} played their card!`)
      }
    }
    else {
      cb(false, `Player ${player.name}[${sessionID}] attempting to play card (${cardID}) they do not own! Hacker!`)
    }
  }

  judgeSelectCard(sessionID, cardID, cb) {
    let latestRound = this.getLatestRound();
    if (this.isRoundJudge(sessionID, latestRound) && latestRound.roundState === 'judge-selecting') {
      let winningCard = _.find(latestRound.otherPlayerCards, card => card.id === cardID);
      if (winningCard) {
        latestRound.roundState = 'viewing-winner';
        latestRound.winningCard = winningCard;
        latestRound.winner = winningCard.owner.name;
        latestRound.roundEndTime = new Date();
        let winningPlayer = _.find(this.players, player => player.pID === winningCard.owner.pID);
        winningPlayer.roundsWon.push({
          roundNum: latestRound.roundNum,
          ACard: winningCard,
          QCard: latestRound.QCard
        });
        cb(true, `${latestRound.winner} won with card ${latestRound.winningCard.text}`)
      }
      else {
        cb(false, `Attempted to play a winning card ${cardID} that was not played!`)
      }
    }
    else {
      cb(false, 'you are not the round judge! you cannot choose the winner!')
    }
  }

  endRound(cb) {
    let latestRound = this.getLatestRound();
    if (latestRound) {
      latestRound.active = false;
      clearTimeout(this.roundTimer)
      // console.log("Before ADeck", this.ACardDeck.length)
      let cardsPlayed = []
      // make a copy of the latestRound.otherPlayerCards
      latestRound.otherPlayerCards.forEach((card) => cardsPlayed.push({ ...card }));
      // remove the 'owners' property on the cards
      cardsPlayed.map(card => delete card.owner)
      // console.log('cardsPlayed, ', cardsPlayed.length)
      // place the cards back into the ACardDeck
      this.ACardDeck = this.ACardDeck.concat(cardsPlayed)
      // console.log("After ADeck", this.ACardDeck.length)
      // console.log("Before QDeck", this.QCardDeck.length)
      this.QCardDeck = this.QCardDeck.concat(latestRound.QCard)
      // console.log("After QDeck", this.QCardDeck.length)
      cb(true, `Round ${latestRound.roundNum} successfully finished`)
    }
    else {
      cb(false, `Cannot endRound(), since no rounds exist for the following game!`)
    }
  }

  shuffleCard(sessionID, srcCardIDIndex, destCardIDIndex, cb) {
    let player = this.getPlayer(sessionID);
    if (player == null) {
      cb(false, `cannot shuffle card! ${sessionID} not a player in game!`)
    }
    let newCardOrder = [...player.cards]
    newCardOrder.splice(srcCardIDIndex, 1)
    newCardOrder.splice(destCardIDIndex, 0, player.cards[srcCardIDIndex])
    player.cards = newCardOrder;
    cb(true, `shuffled ${srcCardIDIndex} <=> ${destCardIDIndex} for ${player.name}`)
  }
}

export default Game;

// --------------------------------------------------------------------------------------------------------------------

// let cb = (success, message) => console.log(`${success} | ${message}`)
// let g = new Game("abc123", 5, cb)


// // Yusuf Joins
// g.addNewPlayer("Yusuf", "yusufSession#123");
// g.addNewPlayer("Salman", "salmanSession#456");
// g.addNewPlayer("Reza", "rezaSession#456");
// console.log('1.------------------------------------------------------------------------')
// console.log(g.getPlayerRoundState('yusufSession#123'))
// console.log(g.getPlayerRoundState('salmanSession#456'))
// console.log(g.getPlayerRoundState('rezaSession#456'))
// console.log('2-------------------------------------------------------------------------')
// // Yusuf Cannot play a card (since he is the judge)
// let yusuf = g.getPlayer('yusufSession#123');
// g.playCard('yusufSession#123', yusuf.cards[0].id)

// // Salman cannot play a card that he does not own
// let salman = g.getPlayer('salmanSession#456');
// g.playCard('salmanSession#456', yusuf.cards[0].id)
// salman can only play a card that he owns
// g.playCard('salmanSession#456', salman.cards[0].id, cb)

// // Reza plays a card
// let reza = g.getPlayer('rezaSession#456');
// g.playCard('rezaSession#456', reza.cards[0].id, cb);
// let latestRound = g.getLatestRound();
// let ACardDeck = reza.cards
// let cardsPlayed = []
// latestRound.otherPlayerCards.forEach((card) => cardsPlayed.push({ ...card }));
// cardsPlayed.map(card => delete card.owner)
// console.log(cardsPlayed.concat(ACardDeck))
// console.log(reza)
// g.endRound(cb)
// console.log(g.getLatestRound())

// console.log('3-------------------------------------------------------------------------')
// console.log(g.getPlayerRoundState('yusufSession#123'))
// console.log(g.getPlayerRoundState('salmanSession#456'))
// console.log(g.getPlayerRoundState('rezaSession#456'));

// // Yusuf choose winning card
// setTimeout(() => {
//   console.log("Choosing the winner!")
//   g.judgeSelectCard('yusufSession#123', g.getLatestRound().otherPlayerCards[1].id);
//   console.log(g.getPlayerRoundState('rezaSession#456'))
//   g.endRound();
// }, 7000)
// // console.log(g.getPlayerRoundState('rezaSession#456'))
// // g.endRound();
// // console.log(g.getPlayerRoundState('rezaSession#456'))