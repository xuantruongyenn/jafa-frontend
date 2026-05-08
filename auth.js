const API_URL = "https://giapha-api-backend.onrender.com";

const auth = {
    mode: 'LOGIN', // Các mode: LOGIN, REGISTER, FORGOT_GET_Q, FORGOT_RESET
    isLoading: false, // Trạng thái loading
    
    setMode(newMode) {
        this.mode = newMode;
        this.updateUI();
    },
    
    updateUI() {
        const els = {
            title: document.getElementById('auth-subtitle'),
            username: document.getElementById('group-username'),
            password: document.getElementById('group-password'),
            confirm: document.getElementById('group-confirm'),
            secSelect: document.getElementById('group-sec-select'),
            secDisplay: document.getElementById('group-sec-display'),
            secAnswer: document.getElementById('group-sec-answer'),
            forgotLink: document.getElementById('auth-forgot-link'),
            btnMain: document.getElementById('auth-btn'),
            btnCancel: document.getElementById('auth-cancel-btn'),
            footer: document.getElementById('auth-footer'),
            labelPass: document.getElementById('label-password'),
            err: document.getElementById('auth-error')
        };

        // Reset trạng thái hiển thị & xóa thông báo lỗi
        els.err.classList.add('hidden');
        document.getElementById('auth-password').value = "";
        document.getElementById('auth-confirm-password').value = "";
        document.getElementById('auth-sec-answer').value = "";
        document.getElementById('auth-username').disabled = false;

        // --- 1. CHẾ ĐỘ ĐĂNG NHẬP ---
        if (this.mode === 'LOGIN') {
            els.title.innerText = "Đăng nhập để quản lý gia phả";
            els.btnMain.innerText = "Đăng Nhập";
            els.labelPass.innerText = "Mật khẩu";
            document.getElementById('auth-password').required = true;
            document.getElementById('auth-confirm-password').required = false;

            els.username.classList.remove('hidden');
            els.password.classList.remove('hidden');
            els.forgotLink.classList.remove('hidden');
            els.footer.classList.remove('hidden');
            
            els.confirm.classList.add('hidden');
            els.secSelect.classList.add('hidden');
            els.secDisplay.classList.add('hidden');
            els.secAnswer.classList.add('hidden');
            els.btnCancel.classList.add('hidden');
            
            document.getElementById('auth-toggle-text').innerText = "Chưa có tài khoản?";
            document.getElementById('auth-toggle-btn').setAttribute('onclick', "auth.setMode('REGISTER')");
            document.getElementById('auth-toggle-btn').innerText = "Tạo tài khoản mới";
        }

        // --- 2. CHẾ ĐỘ ĐĂNG KÝ ---
        if (this.mode === 'REGISTER') {
            els.title.innerText = "Tạo tài khoản mới cho dòng họ";
            els.btnMain.innerText = "Đăng Ký Tài Khoản";
            els.labelPass.innerText = "Mật khẩu";
            document.getElementById('auth-password').required = true;
            document.getElementById('auth-confirm-password').required = true;

            els.username.classList.remove('hidden');
            els.password.classList.remove('hidden');
            els.confirm.classList.remove('hidden');
            els.secSelect.classList.remove('hidden');
            els.secAnswer.classList.remove('hidden');
            els.footer.classList.remove('hidden');

            els.forgotLink.classList.add('hidden');
            els.secDisplay.classList.add('hidden');
            els.btnCancel.classList.add('hidden');

            document.getElementById('auth-toggle-text').innerText = "Đã có tài khoản?";
            document.getElementById('auth-toggle-btn').setAttribute('onclick', "auth.setMode('LOGIN')");
            document.getElementById('auth-toggle-btn').innerText = "Đăng nhập ngay";
        }

        // --- 3. CHẾ ĐỘ QUÊN MK (BƯỚC 1: LẤY CÂU HỎI) ---
        if (this.mode === 'FORGOT_GET_Q') {
            els.title.innerText = "Khôi phục tài khoản";
            els.btnMain.innerText = "Lấy câu hỏi bảo mật";
            document.getElementById('auth-password').required = false;
            document.getElementById('auth-confirm-password').required = false;

            els.username.classList.remove('hidden');
            els.btnCancel.classList.remove('hidden');

            els.password.classList.add('hidden');
            els.confirm.classList.add('hidden');
            els.secSelect.classList.add('hidden');
            els.secDisplay.classList.add('hidden');
            els.secAnswer.classList.add('hidden');
            els.forgotLink.classList.add('hidden');
            els.footer.classList.add('hidden');
        }

        // --- 4. CHẾ ĐỘ QUÊN MK (BƯỚC 2: TRẢ LỜI & ĐỔI MK) ---
        if (this.mode === 'FORGOT_RESET') {
            els.title.innerText = "Đặt lại mật khẩu mới";
            els.btnMain.innerText = "Xác nhận đổi mật khẩu";
            els.labelPass.innerText = "Mật khẩu mới";
            document.getElementById('auth-username').disabled = true; // Khóa không cho đổi user
            document.getElementById('auth-password').required = true;
            document.getElementById('auth-confirm-password').required = true;

            els.username.classList.remove('hidden');
            els.secDisplay.classList.remove('hidden');
            els.secAnswer.classList.remove('hidden');
            els.password.classList.remove('hidden');
            els.confirm.classList.remove('hidden');
            els.btnCancel.classList.remove('hidden');

            els.secSelect.classList.add('hidden');
            els.forgotLink.classList.add('hidden');
            els.footer.classList.add('hidden');
        }
    },

    // Hàm set trạng thái loading
    setLoadingState(loading) {
        this.isLoading = loading;
        const btnMain = document.getElementById('auth-btn');
        
        if (loading) {
            btnMain.disabled = true;
            btnMain.classList.add('opacity-70', 'cursor-not-allowed');
            btnMain.innerHTML = '⏳ Đang xử lý...';
        } else {
            btnMain.disabled = false;
            btnMain.classList.remove('opacity-70', 'cursor-not-allowed');
            
            // Khôi phục text dựa trên mode
            if (this.mode === 'LOGIN') btnMain.innerText = "Đăng Nhập";
            else if (this.mode === 'REGISTER') btnMain.innerText = "Đăng Ký Tài Khoản";
            else if (this.mode === 'FORGOT_GET_Q') btnMain.innerText = "Lấy câu hỏi bảo mật";
            else if (this.mode === 'FORGOT_RESET') btnMain.innerText = "Xác nhận đổi mật khẩu";
        }
    },
    
    async submitForm(e) {
        e.preventDefault();
        
        // Không xử lý nếu đang loading
        if (this.isLoading) return;
        
        const user = document.getElementById('auth-username').value;
        const pass = document.getElementById('auth-password').value;
        const confirmPass = document.getElementById('auth-confirm-password').value;
        const secQuestion = document.getElementById('auth-sec-question').value;
        const secAnswer = document.getElementById('auth-sec-answer').value;
        const errEl = document.getElementById('auth-error');
        
        errEl.classList.add('hidden');

        try {
            // Validate mật khẩu khớp nhau
            if ((this.mode === 'REGISTER' || this.mode === 'FORGOT_RESET') && pass !== confirmPass) {
                throw new Error("Mật khẩu nhập lại không khớp!");
            }

            // Gọi API: BƯỚC LẤY CÂU HỎI
            if (this.mode === 'FORGOT_GET_Q') {
                if(!user) throw new Error("Vui lòng nhập tài khoản!");
                
                this.setLoadingState(true);
                const res = await fetch(`${API_URL}/security-question/${user}`, {
                    signal: AbortSignal.timeout(10000) // Timeout 10 giây
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.detail || "Không tìm thấy tài khoản");
                
                document.getElementById('auth-sec-q-text').innerText = data.question;
                this.setLoadingState(false);
                this.setMode('FORGOT_RESET');
                return;
            }

            // Gọi API: ĐẶT LẠI MẬT KHẨU
            if (this.mode === 'FORGOT_RESET') {
                if(!secAnswer) throw new Error("Vui lòng nhập câu trả lời bảo mật!");
                
                this.setLoadingState(true);
                const res = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: user, new_password: pass, security_answer: secAnswer}),
                    signal: AbortSignal.timeout(10000)
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.detail || "Có lỗi xảy ra");

                this.setLoadingState(false);
                alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
                this.setMode('LOGIN');
                return;
            }

            // Gọi API: ĐĂNG KÝ
            if (this.mode === 'REGISTER') {
                if(!secAnswer) throw new Error("Vui lòng nhập câu trả lời bảo mật!");
                
                this.setLoadingState(true);
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        username: user, 
                        password: pass,
                        security_question: secQuestion,
                        security_answer: secAnswer
                    }),
                    signal: AbortSignal.timeout(10000)
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.detail || "Có lỗi xảy ra");

                this.setLoadingState(false);
                alert("Đăng ký thành công! Vui lòng đăng nhập.");
                this.setMode('LOGIN');
                return;
            }

            // Gọi API: ĐĂNG NHẬP
            if (this.mode === 'LOGIN') {
                this.setLoadingState(true);
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: user, password: pass}),
                    signal: AbortSignal.timeout(10000) // Timeout 10 giây
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.detail || "Có lỗi xảy ra");

                localStorage.setItem('giapha_token', data.access_token);
                localStorage.setItem('giapha_username', data.username);
                
                this.setLoadingState(false);
                alert("Đăng nhập thành công! Bấm OK để vào Gia Phả.");
                window.location.href = "app.html";
            }
        } catch(err) {
            this.setLoadingState(false);
            
            // Xử lý timeout
            if (err.name === 'AbortError') {
                errEl.innerText = '⏱️ Kết nối quá chậm. Vui lòng kiểm tra mạng hoặc thử lại sau.';
            }
            // Xử lý lỗi mạng
            else if (err instanceof TypeError && err.message.includes('fetch')) {
                errEl.innerText = '🔌 Lỗi mạng. Vui lòng kiểm tra kết nối Internet.';
            }
            else {
                errEl.innerText = err.message;
            }
            
            errEl.classList.remove('hidden');
        }
    }
};

// Khởi tạo UI lần đầu
auth.updateUI();
document.getElementById('auth-form').addEventListener('submit', (e) => auth.submitForm(e));
