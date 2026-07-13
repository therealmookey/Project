class NavComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <nav class="main-nav">
                <div class="nav-container">
                    <a href="dashboard.html">🏥 Ziekenhuis Platform</a>
                    <div>
                        <a href="dashboard.html">Dashboard</a>
                        <a href="adressen.html">Adressen</a>
                        <a href="planning.html">Planning</a>
                        <button id="logoutBtn">Uitloggen</button>
                    </div>
                </div>
            </nav>
        `;
    }
}
customElements.define('nav-component', NavComponent);