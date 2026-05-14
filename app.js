const API_URL = "https://giapha-api-backend.onrender.com";

// --- Middleware: Lấy Header chứng thực ---
function getAuthHeaders() {
    const token = localStorage.getItem('giapha_token');
    if (!token) {
        alert("Bạn chưa đăng nhập! Đang quay lại trang đăng nhập...");
        window.location.href = "login.html"; 
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

const app = {
    data: [],
    selectedId: null,
    chartInstance: null,
    zoomScale: 1,
    _addingSpouseFor: null,  // ID của thành viên đang được thêm vợ/chồng
    _spouseIds: new Set(),   // Cache tập hợp các ID là vợ/chồng

    init() {
        document.getElementById('user-greeting').innerText = localStorage.getItem('giapha_username') || '';
        this.initZoomAndPan();
        this.initAvatarUpload(); 
        this.loadData();
    },

    logout() {
        localStorage.removeItem('giapha_token');
        localStorage.removeItem('giapha_username');
        window.location.href = "index.html";
    },

    openStats() {
        document.getElementById('panel-editor').classList.add('hidden');
        document.getElementById('panel-stats').classList.remove('hidden');
        this.toggleMobilePanel(true);
    },

    // --- ĐỔI MẬT KHẨU ---
    openChangePassword() {
        document.getElementById('cp-old').value = '';
        document.getElementById('cp-new').value = '';
        document.getElementById('cp-confirm').value = '';
        document.getElementById('cp-error').classList.add('hidden');
        document.getElementById('change-password-modal').classList.remove('hidden');
    },

    closeChangePassword() {
        document.getElementById('change-password-modal').classList.add('hidden');
    },

    async submitChangePassword() {
        const oldPass = document.getElementById('cp-old').value;
        const newPass = document.getElementById('cp-new').value;
        const confirmPass = document.getElementById('cp-confirm').value;
        const errEl = document.getElementById('cp-error');

        errEl.classList.add('hidden');

        if (!oldPass || !newPass || !confirmPass) {
            errEl.innerText = 'Vui lòng điền đầy đủ thông tin!';
            return errEl.classList.remove('hidden');
        }
        if (newPass !== confirmPass) {
            errEl.innerText = 'Mật khẩu mới nhập lại không khớp!';
            return errEl.classList.remove('hidden');
        }
        if (newPass.length < 6) {
            errEl.innerText = 'Mật khẩu mới phải có ít nhất 6 ký tự!';
            return errEl.classList.remove('hidden');
        }

        try {
            const res = await fetch(`${API_URL}/change-password`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            });

            if (res.status === 401) return this.logout();

            const data = await res.json();
            if (!res.ok) {
                errEl.innerText = data.detail || 'Có lỗi xảy ra!';
                return errEl.classList.remove('hidden');
            }

            this.closeChangePassword();
            alert('✅ Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
            this.logout();
        } catch (e) {
            errEl.innerText = 'Lỗi kết nối, vui lòng thử lại!';
            errEl.classList.remove('hidden');
        }
    },

    // --- AVATAR UPLOAD ---
    initAvatarUpload() {
        const fileInput = document.getElementById('f-avatar-input');
        if (!fileInput) return;
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 300 * 1024) {
                alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 300KB.");
                e.target.value = '';
                return;
            }

            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                if (img.width > 300 || img.height > 300) {
                    alert(`Ảnh quá lớn (${img.width}×${img.height}px)! Vui lòng chọn ảnh tối đa 300×300px.`);
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const base64 = ev.target.result;
                    document.getElementById('f-avatar').value = base64;
                    const preview = document.getElementById('f-avatar-preview');
                    preview.src = base64;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            };
            img.src = objectUrl;
        });
    },

    // --- API HELPER ---
    async _saveToApi(memberData) {
        const res = await fetch(`${API_URL}/add-member`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData)
        });
        if (res.status === 401) { this.logout(); throw new Error('Unauthorized'); }
        if (!res.ok) throw new Error("Lỗi Server");
        return res.json();
    },

    // --- API CALLS ---
    async loadData() {
        try {
            const response = await fetch(`${API_URL}/get-members`, { headers: getAuthHeaders() });
            
            if (response.status === 401) {
                alert("Lỗi: Token của bạn bị từ chối bởi Server (401). Đang quay lại login...");
                return this.logout();
            }
            
            if (response.ok) {
                const dbData = await response.json();
                this.data = Array.isArray(dbData) ? dbData : [];
            }
        } catch (error) { 
            console.error("Lỗi:", error); 
        }
        this._rebuildSpouseIds();
        this.render(); 
        this.updateStats();
    },

    _rebuildSpouseIds() {
        // Chỉ đưa đúng 1 người mỗi cặp vào _spouseIds (người dâu/rể - render inline)
        // Tránh trường hợp lưu 2 chiều (A.spouseId=B và B.spouseId=A) khiến cả hai bị filter
        const result = new Set();
        const seen   = new Set();

        this.data.forEach(m => {
            if (!m.spouseId || seen.has(m.id)) return;
            const spouseId = m.spouseId;
            seen.add(m.id);
            seen.add(spouseId);

            const spouse = this.data.find(p => p.id === spouseId);
            if (!spouse) return;

            const hasParent = id => {
                const v = this.data.find(p => p.id === id);
                return !!(v && v.parentId && v.parentId !== "null" && v.parentId !== "");
            };
            const mHasParent = hasParent(m.id);
            const sHasParent = hasParent(spouseId);

            if (mHasParent && !sHasParent) {
                // m là máu mủ (có cha/mẹ), spouse là dâu/rể
                result.add(spouseId);
            } else if (sHasParent && !mHasParent) {
                // spouse là máu mủ, m là dâu/rể
                result.add(m.id);
            } else {
                // Cả hai đều không có parentId (cặp gốc) hoặc cùng có parentId
                // Tiebreaker 1: ai không có con → là dâu/rể
                const mHasChildren = this.data.some(p => String(p.parentId) === String(m.id));
                const sHasChildren = this.data.some(p => String(p.parentId) === String(spouseId));

                if (!mHasChildren && sHasChildren) {
                    result.add(m.id);          // m không có con → m là dâu/rể
                } else if (!sHasChildren && mHasChildren) {
                    result.add(spouseId);      // spouse không có con → spouse là dâu/rể
                } else {
                    // Tiebreaker 2: người thêm sau (ID lớn hơn theo timestamp) là dâu/rể
                    const mNum = parseInt(m.id) || 0;
                    const sNum = parseInt(spouseId) || 0;
                    result.add(mNum <= sNum ? spouseId : m.id);
                }
            }
        });

        this._spouseIds = result;
    },

    async saveMember(event) {
        event.preventDefault();
        const id = document.getElementById('f-id').value;

        // --- BẮT ĐẦU ĐOẠN CODE THÊM MỚI ---
        let parentIdToSave = document.getElementById('f-parentId').value || null;

        // Kiểm tra xem parentId đang chọn có phải là dâu/rể hay không
        if (parentIdToSave && this._spouseIds.has(parentIdToSave)) {
            const partner1 = this.data.find(p => p.id === parentIdToSave);
            const partner2 = this.data.find(p => p.spouseId === parentIdToSave);

            if (partner1 && partner1.spouseId && !this._spouseIds.has(partner1.spouseId)) {
                parentIdToSave = partner1.spouseId; // Gán lại thành id của người ruột thịt
            } else if (partner2 && !this._spouseIds.has(partner2.id)) {
                parentIdToSave = partner2.id;       // Gán lại thành id của người ruột thịt
            }
        }
        // --- KẾT THÚC ĐOẠN CODE THÊM MỚI ---

        const newData = {
            id: id || Date.now().toString(),
            name: document.getElementById('f-name').value,
            gender: document.getElementById('f-gender').value,
            title: document.getElementById('f-title').value,
            birth: document.getElementById('f-birth').value,
            death: document.getElementById('f-death').value,
            spouse: document.getElementById('f-spouse').value || null,       // backward compat
            desc: document.getElementById('f-desc').value,
            parentId: parentIdToSave, // <--- SỬA DÒNG NÀY (dùng biến parentIdToSave thay vì lấy trực tiếp)
            spouseId: document.getElementById('f-spouseId').value || null,
            avatar: document.getElementById('f-avatar').value || null  
        };

        try {
            // Kiểm tra xem có đang thêm vợ/chồng mới không
            if (this._addingSpouseFor && !id) {
                const partnerOriginalId = this._addingSpouseFor;
                
                // Bước 1: Gán cho người mới (D) trỏ về người gốc (C)
                newData.spouseId = partnerOriginalId;

                // Bước 2: Lưu người mới (D) vào database
                // (Bác dùng nguyên hàm lưu hiện tại của bác ở đây, ví dụ:)
                await this._saveToApi(newData); 

                // Bước 3: QUAN TRỌNG NHẤT - Cập nhật người gốc (C) trỏ ngược lại D
                const originalMember = this.data.find(p => p.id === partnerOriginalId);
                if (originalMember) {
                    // BẮT BUỘC dùng newData.id (vì ID đã được tạo từ Frontend bằng Date.now())
                    originalMember.spouseId = newData.id; 
                    
                    // Gọi lại hàm lưu để cập nhật C vào database
                    await this._saveToApi(originalMember); 
                }

                this._addingSpouseFor = null;
                await this.loadData();
                this.selectMember(newData.id);
            } else {
                await this._saveToApi(newData);
                await this.loadData();
                if (!id) this.selectMember(newData.id); 
                else alert("Lưu thành công!");
            }
        } catch (e) { 
            if (e.message !== 'Unauthorized') alert("Lỗi khi lưu dữ liệu!"); 
        }
    },

    async deleteMember() {
        const id = String(document.getElementById('f-id').value);
        if (!id) return;
        if (this.data.some(p => String(p.parentId) === id)) {
            return alert("Vui lòng xóa dữ liệu con cháu trước.");
        }
        
        if (confirm("Bạn có chắc chắn muốn xóa?")) {
            try {
                const memberToDelete = this.data.find(p => p.id === id);

                // Hủy liên kết vợ/chồng 2 chiều trước khi xóa
                if (memberToDelete && memberToDelete.spouseId) {
                    const spouse = this.data.find(p => p.id === memberToDelete.spouseId);
                    if (spouse) await this._saveToApi({ ...spouse, spouseId: null });
                }
                const partner = this.data.find(p => p.spouseId === id);
                if (partner) await this._saveToApi({ ...partner, spouseId: null });

                const res = await fetch(`${API_URL}/delete-member/${id}`, { 
                    method: 'DELETE',
                    headers: getAuthHeaders() 
                });
                if (res.status === 401) return this.logout();
                
                const result = await res.json();
                if (result.error) return alert("Lỗi DB: " + result.error);
                
                await this.loadData();
                this.closeEditor();
            } catch(e) { 
                if (e.message !== 'Unauthorized') alert("Lỗi mạng khi xóa!"); 
            }
        }
    },

    async exportExcel() {
        try {
            const res = await fetch(`${API_URL}/export-excel`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (res.status === 401) return this.logout();
            if (!res.ok) throw new Error("Lỗi server khi xuất file");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Gia_Pha.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); 
        } catch (e) {
            alert("Lỗi khi xuất Excel: " + e.message);
        }
    },

    // --- XUẤT SƠ ĐỒ CÂY RA PDF ---
    exportPDF() {
        const element = document.getElementById('family-tree-wrapper');
        if (!element || this.data.length === 0) {
            alert("Không có dữ liệu để xuất PDF!");
            return;
        }

        const originalScale = this.zoomScale;
        this.setZoom(1);

        setTimeout(() => {
            const fullWidth = element.scrollWidth;
            const fullHeight = element.scrollHeight;

            const opt = {
                margin: [20, 20, 20, 20],
                filename: `Gia_Pha_${localStorage.getItem('giapha_username') || 'Dong_Ho'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    width: fullWidth,
                    height: fullHeight,
                    windowWidth: fullWidth,
                    windowHeight: fullHeight,
                    scrollX: 0,
                    scrollY: 0,
                    onclone: (clonedDoc) => {
                        clonedDoc.querySelectorAll('.gender-m').forEach(el => {
                            el.style.borderTop = '4px solid #3b82f6';
                        });
                        clonedDoc.querySelectorAll('.gender-f').forEach(el => {
                            el.style.borderTop = '4px solid #ec4899';
                        });
                        clonedDoc.querySelectorAll('.tf-nc').forEach(el => {
                            el.style.backgroundColor = '#fafaf9';
                            el.style.border = '2px solid #a8a29e';
                            el.style.borderRadius = '8px';
                            el.style.boxSizing = 'border-box';
                        });
                        clonedDoc.querySelectorAll('.tf-nc.selected').forEach(el => {
                            el.style.borderColor = '#d97706';
                            el.style.backgroundColor = '#fef3c7';
                        });
                    }
                },
                jsPDF: {
                    unit: 'px', 
                    format: [fullWidth + 40, fullHeight + 40], 
                    orientation: fullWidth > fullHeight ? 'landscape' : 'portrait'
                }
            };

            html2pdf().set(opt).from(element).save()
                .then(() => { this.setZoom(originalScale); })
                .catch(err => {
                    console.error('Lỗi xuất PDF:', err);
                    alert("Có lỗi xảy ra khi xuất PDF!");
                    this.setZoom(originalScale);
                });
        }, 150);
    },
    
    // --- MOBILE PANEL TOGGLE ---
    toggleMobilePanel(forceOpen = null) {
        const panel = document.getElementById('side-panel');
        if (!panel) return;
        if (forceOpen === true) panel.classList.remove('translate-x-full');
        else if (forceOpen === false) panel.classList.add('translate-x-full');
        else panel.classList.toggle('translate-x-full');
    },

    // --- ZOOM & PAN ---
    initZoomAndPan() {
        const container = document.getElementById('tree-container');
        if (!container) return;

        container.addEventListener('wheel', (e) => { 
            if (e.ctrlKey || e.metaKey) { 
                e.preventDefault(); 
                e.deltaY < 0 ? this.zoomIn() : this.zoomOut(); 
            } 
        }, { passive: false });
        
        let isDragging = false, startX, startY, scrollLeft, scrollTop;
        
        const startDrag = (x, y, target) => {
            if (target && target.closest('.tf-nc')) return; 
            isDragging = true;
            startX = x - container.offsetLeft;
            startY = y - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        };
        const stopDrag = () => { isDragging = false; };
        const drag = (x, y, e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            container.scrollLeft = scrollLeft - (x - container.offsetLeft - startX);
            container.scrollTop = scrollTop - (y - container.offsetTop - startY);
        };

        container.addEventListener('mousedown', (e) => startDrag(e.pageX, e.pageY, e.target));
        container.addEventListener('mouseleave', stopDrag);
        container.addEventListener('mouseup', stopDrag);
        container.addEventListener('mousemove', (e) => drag(e.pageX, e.pageY, e));

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) startDrag(e.touches[0].pageX, e.touches[0].pageY, e.target);
        }, {passive: false});
        container.addEventListener('touchend', stopDrag);
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && isDragging) drag(e.touches[0].pageX, e.touches[0].pageY, e);
        }, {passive: false});
    },

    setZoom(scale) { 
        this.zoomScale = Math.min(Math.max(scale, 0.3), 2.5); 
        document.getElementById('family-tree-wrapper').style.transform = `scale(${this.zoomScale})`; 
        document.getElementById('zoom-level').innerText = Math.round(this.zoomScale * 100) + '%'; 
    },
    zoomIn()  { this.setZoom(this.zoomScale + 0.1); }, 
    zoomOut() { this.setZoom(this.zoomScale - 0.1); },

    resetZoom() {
        this.setZoom(1);
        const container = document.getElementById('tree-container');
        if (container) container.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    },

    // --- RENDER ---
    render() {
        const tw = document.getElementById('family-tree-wrapper');
        const es = document.getElementById('empty-state');
        if (this.data.length === 0) { tw.innerHTML = ''; es.classList.remove('hidden'); return; }
        es.classList.add('hidden');

        this._rebuildSpouseIds();

        // Root = không có parentId VÀ không phải là vợ/chồng của ai khác
        const roots = this.data.filter(p => 
            (!p.parentId || p.parentId === "null" || p.parentId === "") && 
            !this._spouseIds.has(p.id)
        );

        if (roots.length > 0) {
            tw.innerHTML = `<div class="tf-tree text-center">${this.buildTreeHTML(roots)}</div>`;
        } else {
            tw.innerHTML = `<div class="bg-white p-6 rounded shadow border border-red-200 text-center mx-auto mt-10">⚠️ Mất liên kết Thủy Tổ. <button onclick="app.startAdding(null)" class="text-blue-500 underline font-bold mt-2">Tạo lại</button></div>`;
        }
    },

    // Render thẻ của một thành viên
    renderMemberCard(n) {
        return `<div class="tf-nc ${n.gender === 'M' ? 'gender-m' : 'gender-f'} ${this.selectedId === n.id ? 'selected' : ''}" onclick="app.selectMember('${n.id}')">
            <div class="font-bold flex flex-col items-center">
                ${n.avatar 
                    ? `<img src="${n.avatar}" class="w-12 h-12 rounded-full object-cover mb-1 border-2 border-white shadow">`
                    : `<span class="text-2xl mb-1">${n.gender === 'M' ? '👨' : '👩'}</span>`
                }
                <span>${n.name}</span>
            </div>
            ${n.title ? `<div class="text-xs text-amber-700 bg-amber-50 inline-block px-1 rounded mt-1">${n.title}</div>` : ''}
            <div class="text-xs text-stone-500 mt-1">${n.birth || '?'} - ${n.death || 'Nay'}</div>
        </div>`;
    },

    buildTreeHTML(nodes) {
        if (!nodes || !nodes.length) return '';

        // Lọc ra những người đang là vợ/chồng (sẽ hiển thị inline, không hiển thị riêng)
        const filtered = nodes.filter(n => !this._spouseIds.has(n.id));
        if (!filtered.length) return '';

        let html = '<ul>';
        filtered.forEach(n => {
            const spouse = n.spouseId ? this.data.find(p => p.id === n.spouseId) : null;

            // Gom con của CẢ HAI người trong cặp vợ chồng
            // Tránh trường hợp con được lưu với parentId trỏ vào người dâu/rể
            const childMap = new Map();
            this.data
                .filter(p => String(p.parentId) === String(n.id) ||
                             (spouse && String(p.parentId) === String(spouse.id)))
                .forEach(c => childMap.set(c.id, c));
            const children = [...childMap.values()];

            html += `<li>`;
            if (spouse) {
                // Hiển thị cặp vợ chồng song song
                html += `<div class="couple-wrapper">
                    ${this.renderMemberCard(n)}
                    <div class="couple-connector">❤️</div>
                    ${this.renderMemberCard(spouse)}
                </div>`;
            } else {
                html += this.renderMemberCard(n);
            }
            html += this.buildTreeHTML(children);
            html += `</li>`;
        });
        return html + '</ul>';
    },

    // --- UX/UI INTERACTION ---
    selectMember(id) {
        this.selectedId = id;
        this._addingSpouseFor = null;
        this.render(); 
        const m = this.data.find(p => p.id === id); 
        if (!m) return;
        
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        document.getElementById('form-title').innerText = 'Thông tin thành viên';

        // Điền dữ liệu vào form
        const fields = ['id', 'parentId', 'name', 'gender', 'title', 'birth', 'death', 'desc', 'avatar', 'spouseId', 'spouse'];
        fields.forEach(k => {
            const el = document.getElementById('f-' + k);
            if (el) el.value = m[k] || '';
        });

        // Preview ảnh
        const preview = document.getElementById('f-avatar-preview');
        if (m.avatar) {
            preview.src = m.avatar;
            preview.classList.remove('hidden');
        } else {
            preview.src = '';
            preview.classList.add('hidden');
        }
        document.getElementById('f-avatar-input').value = '';

        // Hiển thị thông tin vợ/chồng nếu có
        const spouseInfo = document.getElementById('spouse-info');
        const btnAddSpouse = document.getElementById('btn-add-spouse');
        if (m.spouseId) {
            const spouseData = this.data.find(p => p.id === m.spouseId);
            if (spouseData) {
                document.getElementById('spouse-name-display').innerText = spouseData.name;
                spouseInfo.classList.remove('hidden');
                btnAddSpouse.classList.add('hidden');
            } else {
                // spouseId tồn tại nhưng thành viên đó đã bị xóa
                spouseInfo.classList.add('hidden');
                btnAddSpouse.classList.remove('hidden');
            }
        } else {
            spouseInfo.classList.add('hidden');
            btnAddSpouse.classList.remove('hidden');
        }

        document.getElementById('btn-add-child').classList.remove('hidden'); 
        document.getElementById('btn-delete').classList.remove('hidden');

        this.toggleMobilePanel(true);
    },

    startAdding(pId) {
        this.selectedId = null;
        this._addingSpouseFor = null;
        this.render();
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        document.getElementById('member-form').reset();
        document.getElementById('f-avatar').value = '';
        document.getElementById('f-avatar-preview').src = '';
        document.getElementById('f-avatar-preview').classList.add('hidden'); 
        document.getElementById('f-id').value = ''; 
        document.getElementById('f-parentId').value = pId || '';
        document.getElementById('f-spouseId').value = '';
        document.getElementById('form-title').innerText = pId ? 'Thêm thành viên mới' : 'Tạo Thủy Tổ';
        document.getElementById('btn-add-child').classList.add('hidden'); 
        document.getElementById('btn-add-spouse').classList.add('hidden');
        document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('spouse-info').classList.add('hidden');

        this.toggleMobilePanel(true);
    },

    startAddingChild() {
        let id = document.getElementById('f-id').value;
        if (!id) return;

        // Nếu người đang được chọn là dâu/rể, chuyển parentId về người máu mủ
        // để con được rẽ nhánh đúng từ cặp vợ chồng, không phải riêng từ dâu/rể
        if (this._spouseIds.has(id)) {
            const bloodMember = this.data.find(p => p.spouseId === id);
            if (bloodMember) id = bloodMember.id;
        }

        this.startAdding(id);
    },

    startAddingSpouse() {
        const currentId = document.getElementById('f-id').value;
        if (!currentId) return;

        this._addingSpouseFor = currentId;
        this.selectedId = null;
        this.render();

        document.getElementById('panel-stats').classList.add('hidden');
        document.getElementById('panel-editor').classList.remove('hidden');
        document.getElementById('member-form').reset();
        document.getElementById('f-avatar').value = '';
        document.getElementById('f-avatar-preview').src = '';
        document.getElementById('f-avatar-preview').classList.add('hidden');
        document.getElementById('f-id').value = '';
        document.getElementById('f-parentId').value = '';
        document.getElementById('f-spouseId').value = '';
        document.getElementById('form-title').innerText = '💑 Thêm Vợ / Chồng';
        document.getElementById('btn-add-child').classList.add('hidden');
        document.getElementById('btn-add-spouse').classList.add('hidden');
        document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('spouse-info').classList.add('hidden');

        this.toggleMobilePanel(true);
    },

    // Nhảy sang form của vợ/chồng
    viewSpouse() {
        const spouseId = document.getElementById('f-spouseId').value;
        if (spouseId) this.selectMember(spouseId);
    },

    // Hủy liên kết vợ/chồng (giữ cả 2 thành viên, chỉ xóa spouseId)
    async unlinkSpouse() {
        const memberId = document.getElementById('f-id').value;
        const spouseId = document.getElementById('f-spouseId').value;
        if (!memberId || !spouseId) return;

        if (confirm('Hủy liên kết vợ/chồng?\nCả hai thành viên vẫn được giữ lại trong gia phả.')) {
            try {
                const member = this.data.find(p => p.id === memberId);
                const spouse = this.data.find(p => p.id === spouseId);

                if (member) await this._saveToApi({ ...member, spouseId: null });
                if (spouse) await this._saveToApi({ ...spouse, spouseId: null });

                await this.loadData();
                this.selectMember(memberId);
            } catch(e) {
                if (e.message !== 'Unauthorized') alert('Lỗi khi hủy liên kết!');
            }
        }
    },

    closeEditor() { 
        this.selectedId = null;
        this._addingSpouseFor = null;
        this.render(); 
        document.getElementById('panel-editor').classList.add('hidden'); 
        document.getElementById('panel-stats').classList.remove('hidden'); 
        
        if (window.innerWidth < 768) { 
            this.toggleMobilePanel(false); 
        }
    },
    
    // --- STATISTICS ---
    updateStats() {
        this._rebuildSpouseIds();

        // Phân loại ruột thịt vs dâu/rể dựa trên spouseId
        const bloodMembers = this.data.filter(m => !this._spouseIds.has(m.id));
        const inlawMembers = this.data.filter(m => this._spouseIds.has(m.id));
        const bloodCount = bloodMembers.length;
        const inlawCount = inlawMembers.length;
        const totalMembers = this.data.length;
        
        if (document.getElementById('total-members-badge')) document.getElementById('total-members-badge').innerText = totalMembers;
        if (document.getElementById('blood-members-badge')) document.getElementById('blood-members-badge').innerText = bloodCount;
        if (document.getElementById('inlaw-members-badge')) document.getElementById('inlaw-members-badge').innerText = inlawCount;

        let maxD = 0; 
        const getD = (id, cD) => { 
            maxD = Math.max(maxD, cD); 
            this.data.filter(p => p.parentId === id).forEach(c => getD(c.id, cD + 1)); 
        };
        this.data.filter(p => !p.parentId).forEach(r => getD(r.id, 1)); 
        document.getElementById('stat-generations').innerText = maxD;
        
        let maxY = 0; 
        this.data.forEach(p => { 
            if (p.birth && parseInt(p.birth) > maxY) maxY = parseInt(p.birth); 
        }); 
        document.getElementById('stat-latest-year').innerText = maxY || '-';
        
        const mBlood = bloodMembers.filter(m => m.gender === 'M').length;
        const fBlood = bloodMembers.filter(m => m.gender === 'F').length;
        const mInlaw = inlawMembers.filter(m => m.gender === 'M').length;
        const fInlaw = inlawMembers.filter(m => m.gender === 'F').length;
        const living   = this.data.filter(p => !p.death || p.death.toString().trim() === '').length;
        const deceased = this.data.filter(p =>  p.death &&  p.death.toString().trim() !== '').length;

        const tableBody = document.getElementById('stat-table-body');
        if (tableBody) {
            const total = this.data.length || 1;
            const rows = [
                { label: '👨 Nam (ruột thịt)',  count: mBlood,     color: 'text-blue-600',    bg: 'bg-blue-50' },
                { label: '👩 Nữ (ruột thịt)',   count: fBlood,     color: 'text-pink-600',    bg: 'bg-pink-50' },
                { label: '🤝 Ruột thịt (tổng)', count: bloodCount, color: 'text-stone-700',   bg: '' },
                { label: '💑 Dâu / Rể',         count: inlawCount, color: 'text-purple-600',  bg: 'bg-purple-50' },
                { label: '🌱 Còn sống',          count: living,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: '🕊 Đã mất',            count: deceased,   color: 'text-stone-400',   bg: 'bg-stone-50' },
            ];
            tableBody.innerHTML = rows.map((r, i) => {
                const pct = Math.round((r.count / total) * 100);
                const isDivider = i === 2;
                return `<tr class="${r.bg || 'bg-white'} ${isDivider ? 'border-t-2 border-stone-200' : ''}">
                    <td class="px-4 py-2.5 text-stone-700 font-medium">${r.label}</td>
                    <td class="px-3 py-2.5 text-center font-bold ${r.color} text-base">${r.count}</td>
                    <td class="px-3 py-2.5 text-center">
                        <div class="flex items-center gap-1.5 justify-center">
                            <div class="w-14 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                                <div class="h-1.5 rounded-full bg-current ${r.color}" style="width:${pct}%"></div>
                            </div>
                            <span class="text-xs text-stone-400 w-7 text-right">${pct}%</span>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        if (this.chartInstance) { 
            this.chartInstance.data.datasets[0].data = [mBlood, fBlood, mInlaw, fInlaw];
            this.chartInstance.update(); 
        } else { 
            const chartCtx = document.getElementById('genderChart');
            if (chartCtx) {
                this.chartInstance = new Chart(chartCtx.getContext('2d'), { 
                    type: 'doughnut', 
                    data: { 
                        labels: ['Nam (Ruột thịt)', 'Nữ (Ruột thịt)', 'Nam (Dâu rể)', 'Nữ (Dâu rể)'], 
                        datasets: [{ 
                            data: [mBlood, fBlood, mInlaw, fInlaw], 
                            backgroundColor: ['#3b82f6', '#ec4899', '#93c5fd', '#fbcfe8'],
                            borderWidth: 2
                        }] 
                    }, 
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        cutout: '60%', 
                        plugins: {
                            legend: { 
                                position: 'bottom',
                                labels: { boxWidth: 12, padding: 8, font: {size: 11} }
                            },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => ` ${ctx.label}: ${ctx.raw} người`
                                }
                            }
                        } 
                    } 
                });
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tree-container')) {
        app.init();
    }
});
