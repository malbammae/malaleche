import React from 'react'

import Screen from "../../components/Screen/Screen"
import Top from "../../components/Top/Top"
import Title from "../../components/Title/Title"
import Bottom from "../../components/Bottom/Bottom"
import Button from "../../components/Button/Button"
import Card from "../../components/Card/Card"
import Footer from "../../components/Footer/Footer"
import "./JoinPartyScreen.css"

class JoinPartyScreen extends React.Component {
    constructor(props) {
      super(props)
      this.state = {
        partyCode: ""
      }
      this.updatePartyCode = this.updatePartyCode.bind(this);
    }

    updatePartyCode(e) {
      this.setState({
        partyCode: e.target.value
      })
    }

    render() {
      return (
        <Screen>
          <Top>
            <Card cardType="Title" />
          </Top>
          <Bottom>
            <Title text="Join an existing party"/>
            <div className="enterCode center">
              <p className="label">Enter the 5 digit Party Code</p>
              <input className ="input" type="text" name="partyCode" placeholder="cah.co/<enter_party_code>" onChange={this.updatePartyCode}/>
            </div>
            <Button text="Join Party" className="center" disabled={this.state.partyCode.length === 0} link={`/game/${this.state.partyCode}`} />
            <Footer>
              Like us on <a href="http://www.facebook.com/yusufameri"> Facebook!</a>
            </Footer>
          </Bottom>
        </Screen>
      );
    }
}

export default JoinPartyScreen;
