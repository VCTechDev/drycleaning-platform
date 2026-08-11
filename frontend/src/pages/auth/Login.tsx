import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../../services/authService";

function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        try {
            setError("");

            const data = await login({
                username,
                password,
            });

            localStorage.setItem("access_token", data.access);
            localStorage.setItem("refresh_token", data.refresh);

            navigate("/customer/shops");
        } catch (error) {
            console.error(error);
            setError("Invalid username or password.");
        }
    };

    return (
        <div>
            <h1>Login</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>Username</label>

                    <input
                        type="text"
                        value={username}
                        onChange={(event) =>
                            setUsername(event.target.value)
                        }
                    />
                </div>

                <div>
                    <label>Password</label>

                    <input
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                    />
                </div>

                {error && <p>{error}</p>}

                <button type="submit">
                    Login
                </button>
            </form>
        </div>
    );
}

export default Login;