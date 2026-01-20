import React from 'react';
import './UserProfile.css';

function UserProfile({ user, operations, onLogout }) {
  return (
    <div className="user-profile">
      <h2>Личный кабинет</h2>
      {user && (
        <div className="user-info">
          <p><strong>Имя пользователя:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>
      )}

      <h3>История операций</h3>
      <div className="operations-history">
        {operations.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Тип</th>
                <th>Криптовалюта</th>
                <th>Сумма</th>
                <th>Фиат</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {operations.map(op => (
                <tr key={op.operation_id}>
                  <td>{op.operation_type}</td>
                  <td>{op.crypto_currency}</td>
                  <td>{op.crypto_amount}</td>
                  <td>{op.fiat_currency}</td>
                  <td>{op.fiat_amount}</td>
                  <td>{op.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>У вас еще нет операций.</p>
        )}
      </div>

      <button className="btn btn-primary" onClick={onLogout}>Выйти</button>
    </div>
  );
}

export default UserProfile;
