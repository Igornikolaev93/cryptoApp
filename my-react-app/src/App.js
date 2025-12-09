
import React, { useEffect, useState } from 'react';
import './App.css';
import UserProfile from './UserProfile';

function App() {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    fetch('https://api.coincap.io/v2/assets')
      .then(response => response.json())
      .then(data => setAssets(data.data))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  const handleBuy = (asset) => {
    console.log(`Buying ${asset.name}`);
    // Здесь вы можете добавить логику для покупки криптовалюты
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Crypto Exchange</h1>
        <UserProfile />
      </header>
      <div className="asset-list">
        {assets.map(asset => (
          <div key={asset.id} className="asset">
            <h2>{asset.name} ({asset.symbol})</h2>
            <p>Price: ${parseFloat(asset.priceUsd).toFixed(2)}</p>
            <button onClick={() => handleBuy(asset)}>Buy</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
