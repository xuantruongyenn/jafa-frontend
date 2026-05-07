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
    data: [], selectedId: null, chartInstance: null, zoomScale: 1,

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

    // --- AVATAR UPLOAD ---
    initAvatarUpload() {
        const fileInput = document.getElementById('f-avatar-input');
        if (!fileInput) return;
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
 
            // Kiểm tra dung lượng tối đa 300KB
            if (file.size > 300 * 1024) {
                alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 300KB.");
                e.target.value = '';
                return;
            }
 
            // Kiểm tra kích thước pixel tối đa 300x300
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                if (img.width > 300 || img.height > 300) {
                    alert(`Ảnh quá lớn (${img.width}×${img.height}px)! Vui lòng chọn ảnh tối đa 300×300px.`);
                    e.target.value = '';
                    return;
                }
 
                // Hợp lệ → convert sang base64
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
        this.render(); 
        this.updateStats();
    },

    async saveMember(event) {
        event.preventDefault();
        const id = document.getElementById('f-id').value;
        const newData = {
            id: id || Date.now().toString(),
            name: document.getElementById('f-name').value,
            gender: document.getElementById('f-gender').value,
            title: document.getElementById('f-title').value,
            birth: document.getElementById('f-birth').value,
            death: document.getElementById('f-death').value,
            spouse: document.getElementById('f-spouse').value,
            desc: document.getElementById('f-desc').value,
            parentId: document.getElementById('f-parentId').value || null,
            avatar: document.getElementById('f-avatar').value || null  
        };

        try {
            const response = await fetch(`${API_URL}/add-member`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newData)
            });
            if (response.status === 401) return this.logout();
            if (!response.ok) throw new Error("Lỗi Server");
            
            await this.loadData();
            if (!id) this.selectMember(newData.id); 
            else alert("Lưu thành công!");
        } catch (e) { alert("Lỗi khi lưu dữ liệu!"); }
    },

    async deleteMember() {
        const id = String(document.getElementById('f-id').value);
        if(!id) return;
        if(this.data.some(p => String(p.parentId) === id)) {
            return alert("Vui lòng xóa dữ liệu con cháu trước.");
        }
        
        if(confirm("Bạn có chắc chắn muốn xóa?")) {
            try {
                const res = await fetch(`${API_URL}/delete-member/${id}`, { 
                    method: 'DELETE',
                    headers: getAuthHeaders() 
                });
                if(res.status === 401) return this.logout();
                
                const result = await res.json();
                if (result.error) return alert("Lỗi DB: " + result.error);
                
                await this.loadData();
                this.closeEditor();
            } catch(e) { alert("Lỗi mạng khi xóa!"); }
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

        // Thông báo cho người dùng vì quá trình này mất vài giây
        const originalScale = this.zoomScale;
        alert("Hệ thống đang chuẩn bị bản in, vui lòng đợi trong giây lát...");

        // Bước 1: Tạm thời đưa zoom về 100% để chụp ảnh nét nhất
        this.setZoom(1);

        // Bước 2: Cấu hình cho PDF
        const opt = {
            margin:       [10, 10, 10, 10], // Lề [trên, trái, dưới, phải]
            filename:     `Gia_Pha_${localStorage.getItem('giapha_username') || 'Dong_Ho'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, // Tăng độ phân giải ảnh (nét hơn)
                useCORS: true, // Hỗ trợ lấy ảnh avatar từ server khác
                letterRendering: true
            },
            jsPDF:        { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'landscape' // Xuất theo khổ giấy ngang cho cây rộng
            }
        };

        // Bước 3: Thực hiện chuyển đổi và tải về
        html2pdf().set(opt).from(element).save().then(() => {
            // Bước 4: Trả lại mức zoom cũ cho người dùng
            this.setZoom(originalScale);
        }).catch(err => {
            console.error("Lỗi xuất PDF:", err);
            alert("Có lỗi khi tạo PDF. Vui lòng thử lại!");
            this.setZoom(originalScale);
        });
    },
    
    // --- MOBILE PANEL TOGGLE ---
    toggleMobilePanel(forceOpen = null) {
        const panel = document.getElementById('side-panel');
        if (!panel) return;
        if (forceOpen === true) {
            panel.classList.remove('translate-x-full');
        } else if (forceOpen === false) {
            panel.classList.add('translate-x-full');
        } else {
            panel.classList.toggle('translate-x-full');
        }
    },

    // --- ZOOM & PAN ---
    initZoomAndPan() {
        const container = document.getElementById('tree-container');
        if (!container) return;

        // Bắt sự kiện lăn chuột (Zoom)
        container.addEventListener('wheel', (e) => { 
            if (e.ctrlKey || e.metaKey) { 
                e.preventDefault(); 
                e.deltaY < 0 ? this.zoomIn() : this.zoomOut(); 
            } 
        }, { passive: false });
        
        let isDragging = false, startX, startY, scrollLeft, scrollTop;
        
        // Hàm bắt đầu kéo
        const startDrag = (x, y, target) => {
            if(target && target.closest('.tf-nc')) return; 
            isDragging = true;
            startX = x - container.offsetLeft;
            startY = y - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        };
        
        // Hàm dừng kéo
        const stopDrag = () => { isDragging = false; };
        
        // Hàm xử lý khi đang kéo
        const drag = (x, y, e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            container.scrollLeft = scrollLeft - (x - container.offsetLeft - startX);
            container.scrollTop = scrollTop - (y - container.offsetTop - startY);
        };

        // Bắt sự kiện Chuột (Máy tính)
        container.addEventListener('mousedown', (e) => startDrag(e.pageX, e.pageY, e.target));
        container.addEventListener('mouseleave', stopDrag);
        container.addEventListener('mouseup', stopDrag);
        container.addEventListener('mousemove', (e) => drag(e.pageX, e.pageY, e));

        // Bắt sự kiện Cảm ứng (Điện thoại)
        container.addEventListener('touchstart', (e) => {
            if(e.touches.length === 1) startDrag(e.touches[0].pageX, e.touches[0].pageY, e.target);
        }, {passive: false});
        container.addEventListener('touchend', stopDrag);
        container.addEventListener('touchmove', (e) => {
            if(e.touches.length === 1 && isDragging) drag(e.touches[0].pageX, e.touches[0].pageY, e);
        }, {passive: false});
    },

    setZoom(scale) { 
        this.zoomScale = Math.min(Math.max(scale, 0.3), 2.5); 
        document.getElementById('family-tree-wrapper').style.transform = `scale(${this.zoomScale})`; 
        document.getElementById('zoom-level').innerText = Math.round(this.zoomScale * 100) + '%'; 
    },
    zoomIn() { this.setZoom(this.zoomScale + 0.1); }, 
    zoomOut() { this.setZoom(this.zoomScale - 0.1); }, 
    resetZoom() { this.setZoom(1); },

    // --- RENDER ---
    render() {
        const tw = document.getElementById('family-tree-wrapper'), es = document.getElementById('empty-state');
        if (this.data.length === 0) { tw.innerHTML = ''; es.classList.remove('hidden'); return; }
        es.classList.add('hidden');
        const roots = this.data.filter(p => !p.parentId || p.parentId === "null" || p.parentId === "");
        if(roots.length > 0) tw.innerHTML = `<div class="tf-tree text-center">${this.buildTreeHTML(roots)}</div>`;
        else tw.innerHTML = `<div class="bg-white p-6 rounded shadow border border-red-200 text-center mx-auto mt-10">⚠️ Mất liên kết Thủy Tổ. <button onclick="app.startAdding(null)" class="text-blue-500 underline font-bold mt-2">Tạo lại</button></div>`;
    },
    buildTreeHTML(nodes) {
        if (!nodes || !nodes.length) return '';
        let html = '<ul>';
        nodes.forEach(n => {
            const c = this.data.filter(p => p.parentId === n.id);
            
            // Tự động gán màu Vợ/Chồng ngược lại với giới tính của người chính
            const spouseColorClass = n.gender === 'M' ? 'text-pink-600' : 'text-blue-600';
            
            html += `<li><div class="tf-nc ${n.gender === 'M' ? 'gender-m' : 'gender-f'} ${this.selectedId === n.id ? 'selected' : ''}" onclick="app.selectMember('${n.id}')">
                <div class="font-bold flex flex-col items-center">
    ${n.avatar 
        ? `<img src="${n.avatar}" class="w-12 h-12 rounded-full object-cover mb-1 border-2 border-white shadow">`
        : `<span class="text-2xl mb-1">${n.gender === 'M' ? '👨' : '👩'}</span>`
    }
    <span>${n.name}</span>
</div>
                ${n.title ? `<div class="text-xs text-amber-700 bg-amber-50 inline-block px-1 rounded mt-1">${n.title}</div>` : ''}
                <div class="text-xs text-stone-500 mt-1">${n.birth || '?'} - ${n.death || 'Nay'}</div>
${n.spouse ? `<div class="text-xs ${spouseColorClass} mt-1">💑 ${n.spouse}</div>` : ''}
            </div>${this.buildTreeHTML(c)}</li>`;
        }); return html + '</ul>';
    },

    // --- UX/UI INTERACTION ---
    selectMember(id) {
        this.selectedId = id; 
        this.render(); 
        const m = this.data.find(p => p.id === id); 
        if (!m) return;
        
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        ['id','parentId','name','gender','title','birth','death','spouse','desc','avatar'].forEach(k => document.getElementById('f-'+k).value = m[k] || '');

        // Hiển thị preview ảnh
        const preview = document.getElementById('f-avatar-preview');
        if (m.avatar) {
            preview.src = m.avatar;
            preview.classList.remove('hidden');
        } else {
            preview.src = '';
            preview.classList.add('hidden');
        }
        document.getElementById('f-avatar-input').value = '';
        document.getElementById('btn-add-child').classList.remove('hidden'); 
        document.getElementById('btn-delete').classList.remove('hidden');

        // Mở panel trên Mobile
        this.toggleMobilePanel(true);
    },

    startAdding(pId) {
        this.selectedId = null; 
        this.render();
        document.getElementById('panel-stats').classList.add('hidden'); 
        document.getElementById('panel-editor').classList.remove('hidden');
        document.getElementById('member-form').reset();
        document.getElementById('f-avatar').value = '';
        document.getElementById('f-avatar-preview').src = '';
        document.getElementById('f-avatar-preview').classList.add('hidden'); 
        document.getElementById('f-id').value = ''; 
        document.getElementById('f-parentId').value = pId || '';
        document.getElementById('btn-add-child').classList.add('hidden'); 
        document.getElementById('btn-delete').classList.add('hidden');

        // Mở panel trên Mobile
        this.toggleMobilePanel(true);
    },

    startAddingChild() { 
        const id = document.getElementById('f-id').value; 
        if(id) this.startAdding(id); 
    },

    closeEditor() { 
        this.selectedId = null; 
        this.render(); 
        document.getElementById('panel-editor').classList.add('hidden'); 
        document.getElementById('panel-stats').classList.remove('hidden'); 
        
        // Đóng panel đi nếu đang ở màn hình điện thoại
        if (window.innerWidth < 768) { 
            this.toggleMobilePanel(false); 
        }
    },
    
    // --- STATISTICS ---
    updateStats() {
        // Đếm số người ruột thịt (người được thêm vào như một node chính)
        const bloodCount = this.data.length;
        // Đếm số dâu/rể (người được điền vào ô Vợ/Chồng)
        const inlawCount = this.data.filter(p => p.spouse && p.spouse.trim() !== '').length;
        
        // Tổng số thành viên
        const totalMembers = bloodCount + inlawCount;
        
        // Cập nhật số liệu hiển thị trực tiếp lên Header
        if (document.getElementById('total-members-badge')) document.getElementById('total-members-badge').innerText = totalMembers;
        if (document.getElementById('blood-members-badge')) document.getElementById('blood-members-badge').innerText = bloodCount;
        if (document.getElementById('inlaw-members-badge')) document.getElementById('inlaw-members-badge').innerText = inlawCount;

        // Tính số đời
        let maxD = 0; 
        const getD = (id, cD) => { 
            maxD = Math.max(maxD, cD); 
            this.data.filter(p => p.parentId === id).forEach(c => getD(c.id, cD + 1)); 
        };
        this.data.filter(p => !p.parentId).forEach(r => getD(r.id, 1)); 
        document.getElementById('stat-generations').innerText = maxD;
        
        // Tính năm sinh gần nhất
        let maxY = 0; 
        this.data.forEach(p => { 
            if(p.birth && parseInt(p.birth) > maxY) maxY = parseInt(p.birth); 
        }); 
        document.getElementById('stat-latest-year').innerText = maxY || '-';
        
        // Thống kê chi tiết 4 nhóm: Nam ruột, Nữ ruột, Nam rể, Nữ dâu
        let mBlood = 0, fBlood = 0, mInlaw = 0, fInlaw = 0;
        
        this.data.forEach(p => {
            if (p.gender === 'M') {
                mBlood++; // Người chính là Nam -> Nam ruột thịt
                if (p.spouse && p.spouse.trim() !== '') fInlaw++; // Vợ -> Nữ dâu
            } else if (p.gender === 'F') {
                fBlood++; // Người chính là Nữ -> Nữ ruột thịt
                if (p.spouse && p.spouse.trim() !== '') mInlaw++; // Chồng -> Nam rể
            }
        });

        // Vẽ / Cập nhật biểu đồ với 4 chỉ số
        if(this.chartInstance) { 
            this.chartInstance.data.labels = ['Nam (Ruột thịt)', 'Nữ (Ruột thịt)', 'Nam (Dâu rể)', 'Nữ (Dâu rể)'];
            this.chartInstance.data.datasets[0].data = [mBlood, fBlood, mInlaw, fInlaw];
            this.chartInstance.data.datasets[0].backgroundColor = ['#3b82f6', '#ec4899', '#93c5fd', '#fbcfe8']; 
            this.chartInstance.update(); 
        } else { 
            const chartCtx = document.getElementById('genderChart');
            if(chartCtx) {
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
                                    label: function(context) {
                                        return ` ${context.label}: ${context.raw} người`;
                                    }
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